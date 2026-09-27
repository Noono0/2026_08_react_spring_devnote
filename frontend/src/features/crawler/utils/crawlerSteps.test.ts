import { describe, expect, it } from "vitest";
import { createNaverCafeExampleSteps, createStep, toEditableSteps, toRequestSteps, validateSteps } from "@/features/crawler/utils/crawlerSteps";
import { crawlerScenarioStepSchema } from "@/features/crawler/types/webCrawlerTypes";

describe("crawlerSteps", () => {
  it("반복 묶음을 복제해도 하위 추출은 독립적이고 저장 후 순서와 설정을 복원한다", () => {
    const original = createStep("COLLECT", { targetMode: "SELECTOR", target: ".product", fields: [
      { name: "가격", selector: ".price", valueSource: "TEXT", attributeName: "" },
      { name: "링크", selector: "a", valueSource: "ATTRIBUTE", attributeName: "href" },
    ] });
    const copy = createStep(original.type, original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.fields?.[0]?.id).not.toBe(original.fields?.[0]?.id);
    const saved = toRequestSteps([copy]);
    expect(saved[0]?.fields?.[0]).not.toHaveProperty("id");
    expect(toRequestSteps(toEditableSteps(saved))).toEqual(saved);
    expect(crawlerScenarioStepSchema.parse(saved[0]).fields?.map((field) => field.name)).toEqual(["가격", "링크"]);
  });

  it("CSV 순서, 중복 추출 이름, 잘못된 스크롤을 실행 전에 거절한다", () => {
    expect(validateSteps([createStep("CSV")])?.message).toContain("마지막 단계");
    expect(validateSteps([createStep("COLLECT"), createStep("CSV")])).toBeNull();
    expect(validateSteps([createStep("SCROLL", { value: "Infinity" })])?.message).toContain("스크롤");
    const field = { name: "가격", selector: "", valueSource: "TEXT" as const, attributeName: "" };
    expect(validateSteps([createStep("COLLECT", { fields: [field, field] })])?.message).toContain("중복");
  });
  it("네이버 카페 예시는 이동 → 검색어 입력 → Enter → 대기 → 목록 수집 순서다", () => {
    const steps = createNaverCafeExampleSteps("https://cafe.naver.com/lhuniv9", "LH");
    expect(steps.map((step) => step.type)).toEqual(["GOTO", "FILL", "PRESS", "WAIT", "COLLECT"]);
    expect(steps[1]).toMatchObject({ targetMode: "TEXT", target: "카페글 검색어 입력", value: "LH" });
    expect(validateSteps(steps)).toBeNull();
  });

  it("잘못된 단계를 몇 번째 단계인지와 함께 알려준다", () => {
    expect(validateSteps([])?.message).toContain("한 개 이상");
    const goto = createStep("GOTO", { value: "cafe.naver.com" });
    expect(validateSteps([goto])).toMatchObject({ stepId: goto.id, field: "value" });
    expect(validateSteps([goto])?.message).toContain("1단계");
    const click = createStep("CLICK");
    expect(validateSteps([createStep("WAIT"), click])).toMatchObject({ stepId: click.id, field: "target" });
    expect(validateSteps([createStep("CLICK", { targetMode: "COORDINATE", x: 10 })])).toMatchObject({ field: "y" });
  });

  it("목록 반복의 잘못된 하위 추출 항목을 정확히 가리킨다", () => {
    const collect = createStep("COLLECT", { fields: [{ name: "", selector: "", valueSource: "ATTRIBUTE", attributeName: "" }] });
    const field = collect.fields?.[0];
    expect(validateSteps([collect])).toMatchObject({ stepId: collect.id, fieldId: field?.id, field: "name" });
    if (field) field.name = "링크";
    expect(validateSteps([collect])).toMatchObject({ stepId: collect.id, fieldId: field?.id, field: "attributeName" });
  });

  it("요청으로 보낼 때 화면용 id를 빼고 입력값은 그대로 보낸다", () => {
    const [step] = toRequestSteps([createStep("FILL", { target: " 검색 ", value: " LH " })]);
    expect(step).not.toHaveProperty("id");
    expect(step).toMatchObject({ target: "검색", value: " LH " });
  });
});
