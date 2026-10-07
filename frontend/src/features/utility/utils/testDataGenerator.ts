import { createUuid } from "@/shared/lib/createUuid";

// testDataGenerator.ts — 규칙(컬럼명 + 데이터 종류)대로 가짜 테스트 데이터를 만들고 CSV·INSERT SQL로 바꾸는 도구
export type TestDataType = "SEQUENCE" | "STRING" | "NAME" | "EMAIL" | "PHONE" | "INTEGER" | "DECIMAL" | "DATE" | "UUID" | "BOOLEAN" | "ENUM";

export interface TestDataRule {
  ruleId: string;
  columnName: string;
  type: TestDataType;
  option: string;
  nullPercentage: number;
  allowDuplicate: boolean;
}

export type SqlDialect = "GENERIC" | "MYSQL" | "POSTGRESQL" | "SQL_SERVER";

export type TestDataValue = string | number | boolean | null;
export type TestDataRow = Record<string, TestDataValue>;

const koreanLastNames = ["김", "이", "박", "최", "정", "강", "조", "윤"];
const koreanFirstNames = ["민준", "서연", "도윤", "지우", "하준", "서윤", "지호", "수아"];
// 무작위 도우미: minimum~maximum 정수, 배열에서 하나, 영문·숫자 글자열.
const randomInteger = (minimum: number, maximum: number): number => Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
const randomItem = <T,>(items: T[]): T => items[randomInteger(0, items.length - 1)] as T;
const randomText = (length: number): string => Array.from({ length }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[randomInteger(0, 35)]).join("");

// 규칙 하나로 값 하나를 만든다(순번·이름·이메일·전화·숫자·날짜·UUID·참거짓·목록 중 하나 등). 일정 비율로 null을 섞을 수 있다.
const generateValue = (rule: TestDataRule, rowIndex: number): TestDataRow[string] => {
  if (Math.random() * 100 < rule.nullPercentage) return null;
  switch (rule.type) {
    case "SEQUENCE": return rowIndex + 1;
    case "STRING": return `${rule.option || "text"}-${randomText(6)}`;
    case "NAME": return `${randomItem(koreanLastNames)}${randomItem(koreanFirstNames)}`;
    case "EMAIL": return `user${rowIndex + 1}-${randomText(4)}@example.com`;
    case "PHONE": return `010-${randomInteger(1000, 9999)}-${randomInteger(1000, 9999)}`;
    case "INTEGER": {
      const [minimum = 0, maximum = 100] = rule.option.split(",").map(Number);
      return randomInteger(Number.isFinite(minimum) ? minimum : 0, Number.isFinite(maximum) ? maximum : 100);
    }
    case "DECIMAL": {
      const [minimum = 0, maximum = 100] = rule.option.split(",").map(Number);
      return Number((Math.random() * ((maximum || 100) - (minimum || 0)) + (minimum || 0)).toFixed(2));
    }
    case "DATE": {
      const date = new Date();
      date.setDate(date.getDate() - randomInteger(0, 365));
      return date.toISOString().slice(0, 10);
    }
    case "UUID": return createUuid();
    case "BOOLEAN": return Math.random() >= 0.5;
    case "ENUM": {
      const values = rule.option.split(",").map((value) => value.trim()).filter(Boolean);
      if (values.length === 0) throw new Error(`${rule.columnName} Enum 값은 쉼표로 하나 이상 입력해 주세요.`);
      return randomItem(values);
    }
  }
};

// 1~1,000행 생성. 중복을 허용하지 않는 규칙은 이미 나온 값이면 최대 30번 다시 만들어 보고, 그래도 겹치면 오류로 알린다.
export const generateTestData = (rules: TestDataRule[], count: number): TestDataRow[] => {
  if (rules.length === 0) throw new Error("생성 규칙을 하나 이상 추가해 주세요.");
  if (count < 1 || count > 1_000) throw new Error("생성 개수는 1개부터 1,000개까지 가능합니다.");
  const normalizedNames = rules.map((rule) => rule.columnName.trim());
  if (normalizedNames.some((name) => !name)) throw new Error("모든 컬럼명을 입력해 주세요.");
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error("컬럼명은 중복될 수 없습니다.");

  const uniqueValues = new Map<string, Set<unknown>>();
  return Array.from({ length: count }, (_unused, rowIndex) => Object.fromEntries(rules.map((rule) => {
    let value = generateValue(rule, rowIndex);
    if (!rule.allowDuplicate && value !== null) {
      const usedValues = uniqueValues.get(rule.ruleId) ?? new Set<unknown>();
      let attempts = 0;
      while (usedValues.has(value) && attempts < 30) {
        value = generateValue(rule, rowIndex + attempts + 1);
        attempts += 1;
      }
      if (usedValues.has(value)) throw new Error(`${rule.columnName} 컬럼에서 중복 없는 값을 충분히 만들지 못했습니다.`);
      usedValues.add(value);
      uniqueValues.set(rule.ruleId, usedValues);
    }
    return [rule.columnName.trim(), value];
  })));
};

const csvCell = (value: TestDataValue): string => {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const testDataToCsv = (rows: TestDataRow[]): string => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  return [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? null)).join(","))].join("\r\n");
};

// SQL 값 쓰기: 작은따옴표는 두 번('')으로 바꿔 글자 안의 따옴표가 SQL을 깨지 않게 한다. SQL Server는 참거짓을 1·0으로 쓴다.
const sqlValue = (value: TestDataValue, dialect: SqlDialect): string => {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return dialect === "SQL_SERVER" ? (value ? "1" : "0") : String(value).toUpperCase();
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
};

// DB 종류별 이름 감싸기: MySQL 백틱, PostgreSQL 큰따옴표, SQL Server 대괄호.
const sqlIdentifier = (identifier: string, dialect: SqlDialect): string => {
  if (dialect === "MYSQL") return `\`${identifier}\``;
  if (dialect === "POSTGRESQL") return `"${identifier}"`;
  if (dialect === "SQL_SERVER") return `[${identifier}]`;
  return identifier;
};

// 여러 행을 INSERT 한 문장으로 만든다. 테이블·컬럼 이름은 영문·숫자·밑줄만 허용해 이름에 SQL이 섞여 들어가는 것을 막는다.
export const testDataToSql = (rows: TestDataRow[], tableName: string, dialect: SqlDialect = "GENERIC"): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) throw new Error("테이블명은 영문자·숫자·밑줄만 사용할 수 있습니다.");
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0] ?? {});
  if (columns.some((column) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column))) throw new Error("SQL 컬럼명은 영문자·숫자·밑줄만 사용할 수 있습니다.");
  const quotedColumns = columns.map((column) => sqlIdentifier(column, dialect));
  return `INSERT INTO ${sqlIdentifier(tableName, dialect)} (${quotedColumns.join(", ")}) VALUES\n${rows.map((row) => `  (${columns.map((column) => sqlValue(row[column] ?? null, dialect)).join(", ")})`).join(",\n")};`;
};
