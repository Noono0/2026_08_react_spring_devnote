import { downloadText } from "@/features/utility/utils/browserFileUtils";

type CrawlerCsvItem = Record<string, string>;

/** 다운로드 시점의 브라우저 현지 시간을 사용한다. Windows에서 금지된 ':' 대신 '-'를 쓴다. */
export const createCrawlerCsvFileName = (requestedName = "", now = new Date()): string => {
  const requestedBase = requestedName.trim().replace(/\.csv$/i, "");
  // 예전 설정에 저장된 기본 이름에도 새 파일명 규칙을 적용한다.
  const base = !requestedBase || requestedBase === "crawler-results" ? "crawler-result" : requestedBase;
  const safeBase = base.replace(/[\\/:*?"<>|]/g, "_");
  const pad = (value: number): string => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `${safeBase} ${date} ${time}.csv`;
};

/** 수집 필드 뒤에 출처 열(_pageUrl, _pageNumber)을 붙인다. */
export const toCrawlerCsv = (fieldNames: string[], items: CrawlerCsvItem[]): string => {
  const escape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
  const columns = [...fieldNames, "_pageUrl", "_pageNumber"];
  return [
    columns.map(escape).join(","),
    ...items.map((item) => columns.map((column) => escape(item[column] ?? "")).join(",")),
  ].join("\r\n");
};

/** 엑셀이 UTF-8 한글을 인식하도록 BOM을 붙여 내려받는다. */
export const downloadCrawlerCsv = (fileName: string, fieldNames: string[], items: CrawlerCsvItem[]): void => {
  downloadText(fileName, `\uFEFF${toCrawlerCsv(fieldNames, items)}`, "text/csv;charset=utf-8");
};
