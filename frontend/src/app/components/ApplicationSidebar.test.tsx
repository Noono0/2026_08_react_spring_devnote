import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationSidebar } from "@/app/components/ApplicationSidebar";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";
import { PortfolioLayout } from "@/features/portfolio/layouts/PortfolioLayout";

vi.mock("@/features/auth/components/AuthenticationControls", () => ({
  AuthenticationControls: () => <div>로그인 영역</div>,
}));
vi.mock("@/features/auth/hooks/useAuthSession", () => ({
  useAuthSessionQuery: () => ({ data: { authenticated: false, administrator: false } }),
}));
vi.mock("@/features/development/components/DataSourceToggle", () => ({
  DataSourceToggle: () => <div>데이터 소스</div>,
}));

beforeEach(() => {
  useApplicationUiStore.setState({ isSidebarCollapsed: false, isMobileSidebarOpen: false });
});

describe("ApplicationSidebar", () => {
  it("홈·History·React 난이도·개발 유틸리티를 하나의 사이드 메뉴에 표시한다", () => {
    render(<MemoryRouter initialEntries={["/react/level/basic"]}><ApplicationSidebar /></MemoryRouter>);

    const navigation = screen.getByRole("navigation", { name: "전체 사이트 메뉴" });
    expect(within(navigation).getByRole("link", { name: /홈.*소개·연락처·Git·경력 CRUD/ })).toHaveAttribute("href", "/");
    expect(within(navigation).getByRole("link", { name: /나의 업무 History/ })).toHaveAttribute("href", "/history");
    expect(within(navigation).getByRole("link", { name: /전체 로드맵/ })).toHaveAttribute("href", "/react");
    expect(within(navigation).getByRole("link", { name: /^왕초보/ })).toHaveAttribute("href", "/react/level/beginner");
    expect(within(navigation).getByRole("link", { name: /^초급/ })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: /^중급/ })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: /^고급/ })).toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: /API Workspace/ })).not.toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: "각종 유틸리티 게시판 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: /API Workspace/ })).toHaveAttribute("href", "/utilities/api-workspace");
    expect(within(navigation).getByRole("link", { name: /OpenAPI Studio/ })).toHaveAttribute("href", "/utilities/api-workspace/openapi");
    expect(within(navigation).getByRole("link", { name: /JSONPath Explorer/ })).toHaveAttribute("href", "/utilities/jsonpath");
    expect(within(navigation).getByRole("link", { name: /Dependency Analyzer/ })).toHaveAttribute("href", "/utilities/dependencies");
    expect(within(navigation).queryByText("추후 추가 예정")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("초급 CRUD")).not.toBeInTheDocument();
  });

  it("그룹 버튼으로 상세 메뉴를 접고 펼치며 화살표와 접근성 상태를 함께 바꾼다", () => {
    render(<MemoryRouter initialEntries={["/react"]}><ApplicationSidebar /></MemoryRouter>);

    const reactToggle = screen.getByRole("button", { name: "React 연습 메뉴 접기" });
    expect(reactToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(reactToggle).getByText("▴")).toBeInTheDocument();

    fireEvent.click(reactToggle);
    expect(screen.getByRole("button", { name: "React 연습 메뉴 펼치기" })).toHaveAttribute("aria-expanded", "false");
    expect(within(reactToggle).getByText("▾")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /전체 로드맵/ })).not.toBeInTheDocument();

    fireEvent.click(reactToggle);
    expect(screen.getByRole("button", { name: "React 연습 메뉴 접기" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /전체 로드맵/ })).toBeInTheDocument();
  });

  it("공개 화면 레이아웃은 상단 전체 메뉴 없이 공통 사이드바만 사용한다", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<PortfolioLayout />}>
            <Route index element={<p>홈 콘텐츠</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("complementary", { name: "전체 사이트 사이드 메뉴" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "전체 메뉴" })).not.toBeInTheDocument();
    expect(screen.getByText("홈 콘텐츠")).toBeInTheDocument();
  });
});
