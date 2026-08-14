import type { JSONContent } from "@tiptap/core";

export const collectEditorImageFileIds = (content: JSONContent): number[] => {
  const fileIds = new Set<number>();
  const visitNode = (node: JSONContent): void => {
    const source = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    const matchedFileId = source.match(/\/api\/v1\/files\/(\d+)\/content/)?.[1];
    if (matchedFileId) fileIds.add(Number(matchedFileId));
    node.content?.forEach(visitNode);
  };
  visitNode(content);
  return [...fileIds];
};
