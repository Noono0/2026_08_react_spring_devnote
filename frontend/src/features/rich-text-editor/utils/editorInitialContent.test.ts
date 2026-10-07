import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { resolveEditorInitialContent } from "./editorInitialContent";

const filledJson: JSONContent = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }] };
const emptyJson: JSONContent = { type: "doc", content: [] };

describe("resolveEditorInitialContent", () => {
  it("JSON에 내용이 있으면 JSON을 그대로 쓴다", () => {
    expect(resolveEditorInitialContent(filledJson, "<p>다른 본문</p>")).toBe(filledJson);
  });

  it("JSON이 빈 문서인데 HTML에 본문이 있으면 HTML로 채운다 (예전 시드 데이터)", () => {
    expect(resolveEditorInitialContent(emptyJson, "<p>공개 포트폴리오 정리</p>")).toBe("<p>공개 포트폴리오 정리</p>");
    expect(resolveEditorInitialContent(undefined, "<p><img src=\"/api/v1/files/1/content\"></p>")).toBe("<p><img src=\"/api/v1/files/1/content\"></p>");
  });

  it("JSON과 HTML이 모두 비었으면 JSON을 쓴다", () => {
    expect(resolveEditorInitialContent(emptyJson, "<p></p>")).toBe(emptyJson);
    expect(resolveEditorInitialContent(undefined, undefined)).toBeUndefined();
  });
});
