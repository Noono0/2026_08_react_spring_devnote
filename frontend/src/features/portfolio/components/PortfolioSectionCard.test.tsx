import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PortfolioSection } from "@/features/portfolio/types/portfolioTypes";
import { PortfolioSectionCard } from "@/features/portfolio/components/PortfolioSectionCard";

const section: PortfolioSection = {
  portfolioSectionId: 7,
  sectionType: "EXPERIENCE",
  contentMode: "HYBRID",
  sectionTitle: "DevNote Lab",
  sectionSubtitle: "프론트엔드 개발자",
  startDate: "2025-03-01",
  current: true,
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p>React 화면을 개발했습니다.</p>",
  contentText: "React 화면을 개발했습니다.",
  layoutType: "DEFAULT",
  sortOrder: 1,
  visibility: "HIDDEN",
  versionNumber: 1,
  editorImageFileIds: [],
  techStack: [],
  createdAt: "2026-08-01T00:00:00",
  updatedAt: "2026-08-01T00:00:00",
};

describe("PortfolioSectionCard", () => {
  it("슈퍼관리자에게 항목별 공개 전환·수정·삭제 기능을 제공한다", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onVisibilityToggle = vi.fn();
    render(
      <PortfolioSectionCard
        section={section}
        editable
        visibilityPending={false}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onVisibilityToggle={onVisibilityToggle}
      />,
    );

    const visibilitySwitch = screen.getByRole("switch", { name: "DevNote Lab 공개 설정" });
    expect(visibilitySwitch).toHaveAttribute("aria-checked", "false");
    expect(visibilitySwitch).toHaveTextContent("OFF");
    expect(screen.getByText("2025.03 — 현재")).toBeInTheDocument();
    fireEvent.click(visibilitySwitch);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(onVisibilityToggle).toHaveBeenCalledWith(section);
    expect(onEdit).toHaveBeenCalledWith(section);
    expect(onDuplicate).toHaveBeenCalledWith(section);
    expect(onDelete).toHaveBeenCalledWith(section);
  });

  it("공개 방문자에게 관리자 기능을 노출하지 않는다", () => {
    render(
      <PortfolioSectionCard
        section={{ ...section, visibility: "PUBLIC" }}
        editable={false}
        visibilityPending={false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onVisibilityToggle={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DevNote Lab" })).toBeInTheDocument();
  });

  it("프로젝트는 요약·기술 스택·링크만 보여 주고 상세 화면으로 연결한다", () => {
    const longText = "포트폴리오와 학습 플랫폼을 직접 설계·개발·배포했습니다. ".repeat(10);
    render(
      <MemoryRouter>
        <PortfolioSectionCard
          section={{
            ...section,
            portfolioSectionId: 12,
            sectionType: "PROJECT",
            visibility: "PUBLIC",
            contentHtml: "<p>전체 설명</p>",
            contentText: longText,
            techStack: ["React", "Spring Boot"],
            roleSummary: "기획·개발·배포 전체",
            repositoryUrl: "https://github.com/example/devnote",
          }}
          editable={false}
          visibilityPending={false}
          onEdit={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onVisibilityToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "자세히 보기" })).toHaveAttribute("href", "/projects/12");
    expect(screen.getByRole("link", { name: /소스 코드/ })).toHaveAttribute("href", "https://github.com/example/devnote");
    expect(within(screen.getByRole("list", { name: "사용 기술" })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("기획·개발·배포 전체")).toBeInTheDocument();
    // 홈 카드는 전체 HTML 대신 잘린 요약을 보여 준다.
    expect(screen.queryByText("전체 설명")).not.toBeInTheDocument();
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });
});
