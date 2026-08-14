import { collectEditorImageFileIds } from "@/features/portfolio/utils/portfolioEditorContent";

describe("collectEditorImageFileIds", () => {
  it("본문의 포트폴리오 이미지 ID를 중복 없이 순서대로 수집한다", () => {
    const content = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "/api/v1/files/12/content" } },
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { src: "/api/v1/files/7/content" } },
            { type: "image", attrs: { src: "/api/v1/files/12/content" } },
          ],
        },
        { type: "image", attrs: { src: "https://example.com/external.png" } },
      ],
    };

    expect(collectEditorImageFileIds(content)).toEqual([12, 7]);
  });
});
