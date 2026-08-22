import type { PortfolioSection } from "@/features/portfolio/types/portfolioTypes";
import {
  portfolioSectionGroups,
  sortPortfolioBlocks,
  sortPortfolioSections,
  toPortfolioSectionSaveRequest,
} from "@/features/portfolio/utils/portfolioSectionPresentation";

const createSection = (changes: Partial<PortfolioSection> = {}): PortfolioSection => ({
  portfolioSectionId: 1,
  sectionType: "EXPERIENCE",
  contentMode: "HYBRID",
  sectionTitle: "개발팀",
  sectionSubtitle: "프론트엔드 개발자",
  startDate: "2024-03-01",
  current: false,
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p>업무 내용</p>",
  contentText: "업무 내용",
  layoutType: "DEFAULT",
  sortOrder: 1,
  visibility: "PUBLIC",
  versionNumber: 3,
  editorImageFileIds: [11],
  createdAt: "2026-08-01T00:00:00",
  updatedAt: "2026-08-01T00:00:00",
  ...changes,
});

describe("portfolioSectionPresentation", () => {
  it("추천 포트폴리오 영역을 정해진 순서로 제공한다", () => {
    expect(portfolioSectionGroups.map((group) => group.sectionType)).toEqual([
      "PROFILE",
      "RICH_TEXT",
      "IMAGE",
      "SKILL",
      "EXPERIENCE",
      "PROJECT",
      "EDUCATION",
      "CERTIFICATE",
      "CONTACT",
    ]);
  });

  it("기간이 있는 경력은 재직 중과 최근 시작일을 우선한다", () => {
    const sections = [
      createSection({ portfolioSectionId: 1, startDate: "2022-01-01" }),
      createSection({ portfolioSectionId: 2, startDate: "2024-01-01" }),
      createSection({ portfolioSectionId: 3, startDate: "2023-01-01", current: true }),
    ];

    expect(sortPortfolioSections("EXPERIENCE", sections).map((section) => section.portfolioSectionId)).toEqual([3, 2, 1]);
  });

  it("빠른 공개 전환 요청에서도 기존 본문과 버전을 보존한다", () => {
    const section = createSection();

    expect(toPortfolioSectionSaveRequest(section, { visibility: "HIDDEN" })).toMatchObject({
      visibility: "HIDDEN",
      contentHtml: "<p>업무 내용</p>",
      editorImageFileIds: [11],
      versionNumber: 3,
    });
  });

  it("블록형 화면에서는 종류와 관계없이 사용자 순서로 정렬한다", () => {
    const sections = [
      createSection({ portfolioSectionId: 1, sectionType: "EXPERIENCE", sortOrder: 30 }),
      createSection({ portfolioSectionId: 2, sectionType: "PROFILE", sortOrder: 10 }),
      createSection({ portfolioSectionId: 3, sectionType: "IMAGE", sortOrder: 20 }),
    ];

    expect(sortPortfolioBlocks(sections).map((section) => section.portfolioSectionId)).toEqual([2, 3, 1]);
  });
});
