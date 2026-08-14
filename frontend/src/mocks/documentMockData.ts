import type { DocumentDetail, DocumentListItem } from "@/features/document/types/documentTypes";

export const createMockThumbnailDataUrl = (documentSequence: number): string => {
  const hueValue = (documentSequence * 47) % 360;
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hueValue} 78% 52%)"/>
          <stop offset="100%" stop-color="hsl(${(hueValue + 80) % 360} 70% 35%)"/>
        </linearGradient>
      </defs>
      <rect width="800" height="450" rx="28" fill="url(#background)"/>
      <circle cx="680" cy="80" r="150" fill="white" opacity="0.12"/>
      <circle cx="120" cy="410" r="190" fill="white" opacity="0.08"/>
      <text x="64" y="220" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="white">React ${documentSequence}</text>
      <text x="68" y="280" font-family="Arial, sans-serif" font-size="30" fill="white" opacity="0.85">DevNote thumbnail practice</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
};

export const createMockDocuments = (documentCount: number): DocumentListItem[] =>
  Array.from({ length: documentCount }, (_unusedValue, documentIndex) => {
    const documentSequence = documentIndex + 1;
    return {
      documentId: documentSequence,
      documentTitle: `React 연습 문서 ${documentSequence}`,
      documentStatus: documentSequence % 3 === 0 ? "DRAFT" : "PUBLISHED",
      thumbnailFileId: documentSequence % 4 === 0 ? undefined : 500 + documentSequence,
      thumbnailImageUrl: documentSequence % 4 === 0 ? undefined : createMockThumbnailDataUrl(documentSequence),
      versionNumber: 1,
      viewCount: documentSequence * 3,
      authorId: (documentSequence % 4) + 1,
      authorName: `사용자 ${(documentSequence % 4) + 1}`,
      createdAt: "2026-08-01T10:00:00Z",
      updatedAt: "2026-08-04T10:00:00Z",
    };
  });

export const mockDocuments = createMockDocuments(57);

export const createMockDocumentDetail = (documentId: number): DocumentDetail => {
  const listItem = mockDocuments.find((document) => document.documentId === documentId) ?? mockDocuments[0];
  if (!listItem) {
    throw new Error("Mock 문서 데이터가 없습니다.");
  }
  return {
    ...listItem,
    contentJson: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: `${listItem.documentTitle} 내용` }] }],
    },
    contentHtml: `<p>${listItem.documentTitle} 내용입니다.</p>`,
    contentText: `${listItem.documentTitle} 내용입니다.`,
    attachmentFiles: [],
  };
};
