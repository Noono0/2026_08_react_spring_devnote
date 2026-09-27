/**
 * 폼 검증 실패 표시 도우미.
 * 저장·실행 버튼을 눌렀을 때 비어 있거나 형식이 틀린 입력칸을 붉은 테두리(aria-invalid)로 표시하고
 * 화면에서 가장 위에 있는 칸으로 포커스와 스크롤을 옮긴다. 사용자가 그 칸을 고치면 표시가 사라진다.
 */

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const FIELD_SELECTOR = "input, select, textarea";

const isField = (element: Element): element is FieldElement =>
  element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;

/** 이전에 표시한 붉은 테두리를 모두 지운다. */
export const clearInvalidFields = (root: ParentNode | null): void => {
  root?.querySelectorAll("[aria-invalid='true']").forEach((element) => element.removeAttribute("aria-invalid"));
};

/** 사람이 알아볼 수 있는 입력칸 이름(라벨 글자). 별표·도움말은 뺀다. */
export const fieldLabel = (element: Element): string => {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const label = element.closest("label");
  const labelSpan = label?.querySelector(":scope > span");
  const text = (labelSpan ?? label)?.textContent ?? "";
  return text.replace(/\*/g, "").replace(/\s+/g, " ").trim() || (element.getAttribute("name") ?? "입력칸");
};

/**
 * 붉은 테두리를 붙이고 첫 번째 칸에 포커스한다.
 * @returns 표시한 칸 목록(화면 순서)
 */
export const markInvalidFields = (elements: Element[]): FieldElement[] => {
  const fields = elements.filter(isField);
  fields.forEach((field) => {
    field.setAttribute("aria-invalid", "true");
    const clear = (): void => field.removeAttribute("aria-invalid");
    field.addEventListener("input", clear, { once: true });
    field.addEventListener("change", clear, { once: true });
  });
  const [first] = [...fields].sort((left, right) =>
    left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  if (first) {
    first.focus({ preventScroll: true });
    first.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }
  return fields;
};

/**
 * 브라우저 기본 검증(required, type=url, min/max 등)에 걸린 칸을 모두 찾아 표시한다.
 * @returns 문제가 있는 칸의 이름 목록. 비어 있으면 통과.
 */
export const highlightInvalidFields = (root: ParentNode | null): string[] => {
  clearInvalidFields(root);
  if (!root) return [];
  const invalid = [...root.querySelectorAll(FIELD_SELECTOR)]
    .filter(isField)
    .filter((field) => !field.disabled && !field.checkValidity());
  markInvalidFields(invalid);
  return [...new Set(invalid.map(fieldLabel))];
};
