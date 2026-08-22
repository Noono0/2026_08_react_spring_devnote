import { fireEvent, render, screen } from "@testing-library/react";
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
});
