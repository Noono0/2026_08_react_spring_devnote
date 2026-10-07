import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getPortfolioSections } from "@/features/portfolio/api/portfolioApi";
import type { PortfolioSection } from "@/features/portfolio/types/portfolioTypes";
import { PortfolioProjectDetailPage } from "./PortfolioProjectDetailPage";

vi.mock("@/features/portfolio/api/portfolioApi", () => ({ getPortfolioSections: vi.fn() }));
const mockedGetPortfolioSections = vi.mocked(getPortfolioSections);

const project: PortfolioSection = {
  portfolioSectionId: 12,
  sectionType: "PROJECT",
  contentMode: "HYBRID",
  sectionTitle: "DevNote",
  sectionSubtitle: "포트폴리오·학습 플랫폼",
  startDate: "2026-08-01",
  current: true,
  contentJson: { type: "doc" },
  contentHtml: "<h2>문제와 해결</h2><p>업로드 한도를 맞췄습니다.</p><script>alert(1)</script>",
  contentText: "문제와 해결",
  layoutType: "DEFAULT",
  sortOrder: 10,
  visibility: "PUBLIC",
  versionNumber: 1,
  editorImageFileIds: [],
  techStack: ["React", "Spring Boot"],
  roleSummary: "기획·개발·배포 전체",
  demoUrl: "https://devnote.example.com",
  createdAt: "2026-08-01T00:00:00",
  updatedAt: "2026-08-01T00:00:00",
};

const renderAt = (path: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/projects/:sectionId" element={<PortfolioProjectDetailPage />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

describe("PortfolioProjectDetailPage", () => {
  beforeEach(() => {
    mockedGetPortfolioSections.mockReset();
  });

  it("프로젝트의 기간·역할·기술·링크와 정화된 전체 설명을 보여 준다", async () => {
    mockedGetPortfolioSections.mockResolvedValue([project]);
    const { container } = renderAt("/projects/12");

    expect(await screen.findByRole("heading", { level: 1, name: "DevNote" })).toBeInTheDocument();
    expect(screen.getByText("기획·개발·배포 전체")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "사용 기술" })).toHaveTextContent("ReactSpring Boot");
    expect(screen.getByRole("link", { name: /데모/ })).toHaveAttribute("href", "https://devnote.example.com");
    expect(screen.getByRole("heading", { name: "문제와 해결" })).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("없는 번호나 잘못된 주소는 찾을 수 없다고 안내한다", async () => {
    mockedGetPortfolioSections.mockResolvedValue([project]);
    renderAt("/projects/99");
    expect(await screen.findByRole("alert")).toHaveTextContent("프로젝트를 찾을 수 없습니다");
  });

  it("프로젝트가 아닌 섹션 번호로는 열리지 않는다", async () => {
    mockedGetPortfolioSections.mockResolvedValue([{ ...project, sectionType: "EXPERIENCE" }]);
    renderAt("/projects/12");
    expect(await screen.findByRole("alert")).toHaveTextContent("프로젝트를 찾을 수 없습니다");
  });
});
