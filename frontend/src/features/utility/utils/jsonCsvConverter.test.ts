import { describe, expect, it } from "vitest";
import { convertJsonCsv, parseCsvRows } from "@/features/utility/utils/jsonCsvConverter";

describe("JSON → CSV 변환", () => {
  it("서로 다른 객체 속성을 Header 합집합으로 만들고 특수문자를 escaping한다", () => {
    const result = convertJsonCsv(JSON.stringify([
      { name: "홍길동", city: "서울, 대한민국" },
      { name: '김"개발', active: true },
    ]), { direction: "JSON_TO_CSV", delimiter: ",", firstRowIsHeader: true, inferValueTypes: false });

    expect(result.headers).toEqual(["name", "city", "active"]);
    expect(result.output).toContain('홍길동,"서울, 대한민국",');
    expect(result.output).toContain('"김""개발",,true');
    expect(result.rowCount).toBe(2);
  });

  it("최상위 객체나 원시값 배열은 명확한 오류로 거절한다", () => {
    expect(() => convertJsonCsv('{"name":"DevNote"}', { direction: "JSON_TO_CSV", delimiter: ",", firstRowIsHeader: true, inferValueTypes: false })).toThrow("객체 배열");
    expect(() => convertJsonCsv('[1,2,3]', { direction: "JSON_TO_CSV", delimiter: ",", firstRowIsHeader: true, inferValueTypes: false })).toThrow("모든 항목");
  });
});

describe("CSV → JSON 변환", () => {
  it("셀 내부 구분자·줄바꿈·escaped quote를 보존한다", () => {
    const rows = parseCsvRows('name,memo\r\n홍길동,"첫째 줄\n둘째, 줄"\r\n김개발,"따옴표 ""예제"""', ",");

    expect(rows[1]).toEqual(["홍길동", "첫째 줄\n둘째, 줄"]);
    expect(rows[2]).toEqual(["김개발", '따옴표 "예제"']);
  });

  it("옵션을 켠 경우에만 안전한 숫자·boolean·null 타입을 추론한다", () => {
    const result = convertJsonCsv("id,score,active,note\n00123,42,true,null", {
      direction: "CSV_TO_JSON", delimiter: ",", firstRowIsHeader: true, inferValueTypes: true,
    });
    const records = JSON.parse(result.output) as Array<Record<string, unknown>>;

    expect(records[0]).toEqual({ id: "00123", score: 42, active: true, note: null });
  });

  it("중복 Header와 행별 열 개수 불일치를 거절한다", () => {
    expect(() => convertJsonCsv("name,name\nA,B", { direction: "CSV_TO_JSON", delimiter: ",", firstRowIsHeader: true, inferValueTypes: false })).toThrow("중복");
    expect(() => convertJsonCsv("name,age\n홍길동", { direction: "CSV_TO_JSON", delimiter: ",", firstRowIsHeader: true, inferValueTypes: false })).toThrow("열 개수");
  });
});
