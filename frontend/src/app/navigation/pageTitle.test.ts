import { createDocumentTitle } from "@/app/navigation/pageTitle";

describe("createDocumentTitle", () => {
  it("홈은 사이트 이름만, 학습 화면은 학습 가이드 제목을 쓴다", () => {
    expect(createDocumentTitle("/")).toBe("DevNote Portfolio");
    expect(createDocumentTitle("/react/infinite-feed")).toBe("무한 스크롤 피드 | DevNote");
    expect(createDocumentTitle("/react/documents/3/edit")).toContain("| DevNote");
  });

  it("하위 주소는 가장 긴 메뉴 주소의 이름을 쓴다", () => {
    expect(createDocumentTitle("/utilities/api-workspace/mock")).toBe("Mock API | DevNote");
    expect(createDocumentTitle("/history/12")).toBe("나의 업무 History | DevNote");
    expect(createDocumentTitle("/admin/members")).toBe("회원관리 | DevNote");
  });

  it("메뉴에 없는 주소는 기본 제목을 쓴다", () => {
    expect(createDocumentTitle("/unknown-page")).toBe("DevNote Portfolio");
  });
});
