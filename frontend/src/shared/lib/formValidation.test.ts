import { describe, expect, it } from "vitest";
import { highlightInvalidFields, markInvalidFields } from "@/shared/lib/formValidation";

describe("formValidation", () => {
  it("비어 있는 필수 칸을 붉게 표시하고 첫 칸에 포커스하며, 입력하면 표시를 지운다", () => {
    document.body.innerHTML = `
      <form>
        <label><span><span class="crawler-required-mark"></span> 수집할 URL</span><input id="url" type="url" required /></label>
        <label><span>메모</span><input id="memo" /></label>
        <label><span><span class="crawler-required-mark"></span> 반복 항목 선택자</span><input id="item" required /></label>
      </form>`;
    const form = document.querySelector("form");

    expect(highlightInvalidFields(form)).toEqual(["수집할 URL", "반복 항목 선택자"]);
    const url = document.getElementById("url") as HTMLInputElement;
    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("memo")).not.toHaveAttribute("aria-invalid");
    expect(document.activeElement).toBe(url);

    url.value = "https://example.com";
    url.dispatchEvent(new Event("input"));
    expect(url).not.toHaveAttribute("aria-invalid");
  });

  it("화면 규칙에 걸린 칸만 직접 표시할 수 있다", () => {
    document.body.innerHTML = `<input id="a" /><input id="b" />`;
    const b = document.getElementById("b") as HTMLInputElement;
    markInvalidFields([b]);
    expect(b).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(b);
  });
});
