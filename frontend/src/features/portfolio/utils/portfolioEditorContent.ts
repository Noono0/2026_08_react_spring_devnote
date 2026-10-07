import type { JSONContent } from "@tiptap/core";

/**
 * 에디터 본문(JSON 트리)을 끝까지 훑어 이미지 주소 /api/v1/files/{번호}/content의 번호를 모은다.
 * 서버는 이 번호들로 섹션과 이미지를 연결하고, 연결된 이미지를 임시 파일 정리 대상에서 뺀다.
 *
 * visitNode가 자기 자신을 다시 부르는 "재귀"로 문단 → 표 → 칸 → 이미지처럼 깊이에 상관없이 모두 방문한다.
 * Set을 써서 같은 이미지를 두 번 넣어도 번호는 한 번만 남는다.
 */
export const collectEditorImageFileIds = (content: JSONContent): number[] => {
  const fileIds = new Set<number>();
  const visitNode = (node: JSONContent): void => {
    const source = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    // 정규식의 (\d+) 부분(숫자)이 [1]번 그룹으로 나온다. 일치하지 않으면 undefined.
    const matchedFileId = source.match(/\/api\/v1\/files\/(\d+)\/content/)?.[1];
    if (matchedFileId) fileIds.add(Number(matchedFileId));
    node.content?.forEach(visitNode);
  };
  visitNode(content);
  return [...fileIds];
};
