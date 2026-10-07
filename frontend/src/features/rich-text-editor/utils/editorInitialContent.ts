/**
 * ============================================================================
 * editorInitialContent.ts — 저장된 본문 중 무엇으로 에디터를 채울지 정한다
 * ============================================================================
 *
 * [해결하는 문제]
 *   문서는 본문을 JSON(편집용)·HTML(표시용)·텍스트(검색용) 세 벌로 저장한다.
 *   에디터는 보통 JSON으로 채우는데, 예전 시드 데이터나 오래된 글 중에는
 *   "JSON은 빈 문서인데 HTML에는 본문이 있는" 경우가 있었다.
 *
 *   그대로 JSON을 넣으면?
 *     - 수정 화면의 에디터가 빈 칸으로 보인다 (상세 화면에는 HTML이라 글이 멀쩡히 보인다)
 *     - 사용자가 빈 줄 알고 글을 쓰면, 저장할 때 원래 HTML 본문이 새 글로 덮어써져 사라진다
 *
 * [해결 방법]
 *   JSON에 실제 내용이 없고 HTML에 글자가 있으면 HTML 문자열로 에디터를 채운다.
 *   Tiptap은 JSON뿐 아니라 HTML 문자열도 초기 내용으로 받을 수 있다.
 *   한 번 수정해서 저장하면 에디터가 만든 올바른 JSON이 함께 저장되어 데이터도 바로잡힌다.
 */

import type { Content, JSONContent } from "@tiptap/core";

/** JSON 본문에 문단·글자 같은 실제 노드가 하나라도 있는지 확인한다. */
const hasJsonNodes = (contentJson: JSONContent | undefined): boolean =>
  // content가 없거나 빈 배열이면 "빈 문서"다. ({ type: "doc", content: [] })
  (contentJson?.content?.length ?? 0) > 0;

/** HTML에서 태그를 걷어 냈을 때 보이는 글자가 있는지 확인한다. "<p></p>"는 빈 본문으로 본다. */
const hasVisibleHtmlText = (contentHtml: string | undefined): boolean =>
  // 정규식 /<[^>]*>/g = "<"로 시작해 ">"로 끝나는 태그를 전부 찾는다. 지우고 남은 글자가 있으면 본문이 있는 것이다.
  // 이미지만 있는 본문(<img>)도 내용으로 인정한다.
  (contentHtml ?? "").replace(/<[^>]*>/g, "").trim().length > 0 || /<img\s/i.test(contentHtml ?? "");

/**
 * 에디터 초기 내용을 고른다.
 *   - JSON에 내용이 있으면 JSON (정상적인 경우)
 *   - JSON이 비었는데 HTML에 본문이 있으면 HTML (예전 데이터 대비)
 *   - 둘 다 비었으면 JSON (빈 에디터)
 */
export const resolveEditorInitialContent = (
  contentJson: JSONContent | undefined,
  contentHtml: string | undefined,
): Content | undefined => {
  if (!hasJsonNodes(contentJson) && hasVisibleHtmlText(contentHtml)) {
    return contentHtml;
  }
  return contentJson;
};
