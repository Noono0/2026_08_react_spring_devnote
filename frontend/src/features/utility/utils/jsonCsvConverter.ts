export type JsonCsvDirection = "JSON_TO_CSV" | "CSV_TO_JSON";
export type CsvDelimiter = "," | ";" | "\t";

export interface JsonCsvConversionOptions {
  direction: JsonCsvDirection;
  delimiter: CsvDelimiter;
  firstRowIsHeader: boolean;
  inferValueTypes: boolean;
}

export interface JsonCsvConversionResult {
  output: string;
  headers: string[];
  previewRows: string[][];
  rowCount: number;
}

const MAXIMUM_ROW_COUNT = 10_000;

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * CSV 값에 구분자·따옴표·줄바꿈이 들어가면 RFC 4180 방식으로 감쌉니다.
 * 값 내부의 큰따옴표는 두 번 반복해야 다시 파싱할 때 원래 값으로 복원됩니다.
 */
const escapeCsvCell = (value: string, delimiter: CsvDelimiter): string => {
  const escapedValue = value.replace(/"/g, '""');
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${escapedValue}"` : escapedValue;
};

const stringifyJsonValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const convertJsonToCsv = (
  source: string,
  delimiter: CsvDelimiter,
): JsonCsvConversionResult => {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(source);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "JSON 문법을 해석하지 못했습니다.";
    throw new Error(`JSON 문법 오류: ${errorMessage}`);
  }

  if (!Array.isArray(parsedJson)) {
    throw new Error("JSON → CSV 변환은 최상위 값이 객체 배열이어야 합니다.");
  }
  if (parsedJson.length === 0) {
    throw new Error("변환할 JSON 배열이 비어 있습니다.");
  }
  if (parsedJson.length > MAXIMUM_ROW_COUNT) {
    throw new Error(`한 번에 최대 ${MAXIMUM_ROW_COUNT.toLocaleString("ko-KR")}행까지 변환할 수 있습니다.`);
  }
  if (!parsedJson.every(isJsonObject)) {
    throw new Error("JSON 배열의 모든 항목은 { key: value } 형태의 객체여야 합니다.");
  }

  // 행마다 필드 구성이 달라도 데이터가 사라지지 않도록 등장 순서대로 Header 합집합을 만듭니다.
  const headers: string[] = [];
  const knownHeaders = new Set<string>();
  parsedJson.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!knownHeaders.has(key)) {
        knownHeaders.add(key);
        headers.push(key);
      }
    });
  });
  if (headers.length === 0) {
    throw new Error("CSV Header로 사용할 JSON 객체의 속성이 없습니다.");
  }

  const previewRows = parsedJson.map((record) =>
    headers.map((header) => stringifyJsonValue(record[header])),
  );
  const csvLines = [
    headers.map((header) => escapeCsvCell(header, delimiter)).join(delimiter),
    ...previewRows.map((row) => row.map((value) => escapeCsvCell(value, delimiter)).join(delimiter)),
  ];

  return { output: csvLines.join("\r\n"), headers, previewRows, rowCount: previewRows.length };
};

/**
 * split(',')만 사용하면 "서울, 대한민국"이나 셀 안 줄바꿈을 처리할 수 없습니다.
 * 따라서 따옴표 안/밖 상태를 추적하는 작은 상태 머신으로 CSV를 한 글자씩 읽습니다.
 */
export const parseCsvRows = (source: string, delimiter: CsvDelimiter): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;
  let justClosedQuote = false;

  const pushCell = (): void => {
    currentRow.push(currentCell);
    currentCell = "";
    justClosedQuote = false;
  };
  const pushRow = (): void => {
    pushCell();
    rows.push(currentRow);
    currentRow = [];
  };

  for (let characterIndex = 0; characterIndex < source.length; characterIndex += 1) {
    const character = source[characterIndex];
    const nextCharacter = source[characterIndex + 1];

    if (insideQuotes) {
      if (character === '"' && nextCharacter === '"') {
        currentCell += '"';
        characterIndex += 1;
      } else if (character === '"') {
        insideQuotes = false;
        justClosedQuote = true;
      } else {
        currentCell += character;
      }
      continue;
    }

    if (character === '"') {
      if (currentCell.length > 0 || justClosedQuote) {
        throw new Error(`${rows.length + 1}행에서 큰따옴표 위치가 올바르지 않습니다.`);
      }
      insideQuotes = true;
      continue;
    }
    if (justClosedQuote && character !== delimiter && character !== "\r" && character !== "\n") {
      throw new Error(`${rows.length + 1}행의 닫는 큰따옴표 뒤에는 구분자 또는 줄바꿈이 와야 합니다.`);
    }
    if (character === delimiter) {
      pushCell();
      continue;
    }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && nextCharacter === "\n") characterIndex += 1;
      pushRow();
      continue;
    }
    currentCell += character;
  }

  if (insideQuotes) {
    throw new Error("닫히지 않은 큰따옴표가 있습니다.");
  }
  if (currentCell.length > 0 || currentRow.length > 0) pushRow();
  if (rows.length > MAXIMUM_ROW_COUNT + 1) {
    throw new Error(`한 번에 최대 ${MAXIMUM_ROW_COUNT.toLocaleString("ko-KR")}행까지 변환할 수 있습니다.`);
  }
  return rows;
};

const inferCsvValue = (value: string): string | number | boolean | null => {
  const trimmedValue = value.trim();
  if (trimmedValue === "null") return null;
  if (trimmedValue === "true") return true;
  if (trimmedValue === "false") return false;
  // 00123 같은 ID가 123으로 손상되지 않도록 앞에 0이 붙은 숫자는 문자열로 유지합니다.
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmedValue)) {
    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue)) return numericValue;
  }
  return value;
};

const convertCsvToJson = (
  source: string,
  delimiter: CsvDelimiter,
  firstRowIsHeader: boolean,
  inferValueTypes: boolean,
): JsonCsvConversionResult => {
  const rows = parseCsvRows(source.replace(/^\uFEFF/, ""), delimiter);
  if (rows.length === 0) throw new Error("변환할 CSV 내용이 없습니다.");

  const maximumColumnCount = Math.max(...rows.map((row) => row.length));
  const firstRow = rows[0] ?? [];
  const headers = firstRowIsHeader
    ? firstRow.map((header) => header.trim())
    : Array.from({ length: maximumColumnCount }, (_, columnIndex) => `column${columnIndex + 1}`);

  if (headers.some((header) => !header)) throw new Error("CSV Header에는 빈 이름을 사용할 수 없습니다.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV Header 이름은 중복될 수 없습니다.");

  const dataRows = firstRowIsHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) throw new Error("CSV Header 아래에 변환할 데이터 행이 없습니다.");
  const mismatchedRowIndex = dataRows.findIndex((row) => row.length !== headers.length);
  if (mismatchedRowIndex >= 0) {
    const sourceRowNumber = mismatchedRowIndex + (firstRowIsHeader ? 2 : 1);
    throw new Error(`${sourceRowNumber}행의 열 개수(${dataRows[mismatchedRowIndex]?.length ?? 0})가 Header 개수(${headers.length})와 다릅니다.`);
  }

  const jsonRecords = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, columnIndex) => [
      header,
      inferValueTypes ? inferCsvValue(row[columnIndex] ?? "") : row[columnIndex] ?? "",
    ])),
  );

  return {
    output: JSON.stringify(jsonRecords, null, 2),
    headers,
    previewRows: dataRows,
    rowCount: dataRows.length,
  };
};

export const convertJsonCsv = (
  source: string,
  options: JsonCsvConversionOptions,
): JsonCsvConversionResult => {
  if (!source.trim()) throw new Error("변환할 내용을 입력해 주세요.");
  return options.direction === "JSON_TO_CSV"
    ? convertJsonToCsv(source, options.delimiter)
    : convertCsvToJson(source, options.delimiter, options.firstRowIsHeader, options.inferValueTypes);
};
