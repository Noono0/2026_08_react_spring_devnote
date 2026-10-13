import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationSidebar } from "@/app/components/ApplicationSidebar";
import { SIDEBAR_WIDTH_RANGE, useApplicationUiStore } from "@/app/state/applicationUiStore";
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

describe("사이드바 너비 조절", () => {
  beforeEach(() => {
    localStorage.removeItem("sidebarWidth");
    useApplicationUiStore.getState().setSidebarWidth(SIDEBAR_WIDTH_RANGE.initial);
  });

  it("손잡이에서 ←/→(Shift는 크게)로 너비를 바꾸고, 범위(240~520px)를 넘지 않으며 CSS 변수와 저장소에 반영한다", () => {
    render(<MemoryRouter initialEntries={["/"]}><ApplicationSidebar /></MemoryRouter>);
    const handle = screen.getByRole("button", { name: "사이드바 너비 조절 (지금 300px)" });

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "사이드바 너비 조절 (지금 320px)" })).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--sidebar-width")).toBe("320px");
    expect(localStorage.getItem("sidebarWidth")).toBe("320");

    for (let count = 0; count < 10; count += 1) fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    expect(useApplicationUiStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH_RANGE.max);
    for (let count = 0; count < 10; count += 1) fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    expect(useApplicationUiStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH_RANGE.min);

    fireEvent.doubleClick(handle); // 더블클릭하면 기본 너비
    expect(useApplicationUiStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH_RANGE.initial);
  });

  it("사이드바를 접으면 너비 조절 손잡이를 숨긴다", () => {
    useApplicationUiStore.setState({ isSidebarCollapsed: true });
    render(<MemoryRouter initialEntries={["/"]}><ApplicationSidebar /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /사이드바 너비 조절/ })).not.toBeInTheDocument();
  });
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

    // 유틸리티: 2단계(홈·크롤링 도구)는 바로 보이고, 나머지는 종류별 묶음(3단계)을 펼쳐야 보인다.
    fireEvent.click(within(navigation).getByRole("button", { name: "각종 유틸리티 게시판 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: /웹 크롤링 도구/ })).toHaveAttribute("href", "/utilities/crawler");
    expect(within(navigation).queryByRole("link", { name: /API Workspace/ })).not.toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: "API 개발·테스트 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: /API Workspace/ })).toHaveAttribute("href", "/utilities/api-workspace");
    expect(within(navigation).getByRole("link", { name: /OpenAPI Studio/ })).toHaveAttribute("href", "/utilities/api-workspace/openapi");
    fireEvent.click(within(navigation).getByRole("button", { name: "데이터 변환·조회 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: /JSONPath Explorer/ })).toHaveAttribute("href", "/utilities/jsonpath");
    fireEvent.click(within(navigation).getByRole("button", { name: "설계·분석 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: /Dependency Analyzer/ })).toHaveAttribute("href", "/utilities/dependencies");
    fireEvent.click(within(navigation).getByRole("button", { name: "API 개발·테스트 메뉴 접기" }));
    expect(within(navigation).queryByRole("link", { name: /API Workspace/ })).not.toBeInTheDocument();
    expect(within(navigation).queryByText("추후 추가 예정")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("초급 CRUD")).not.toBeInTheDocument();
  });

  it("유틸리티 화면으로 바로 들어오면 그 화면이 들어 있는 3단계 묶음까지 펼쳐 현재 메뉴를 보여 준다", () => {
    render(<MemoryRouter initialEntries={["/utilities/sql-formatter"]}><ApplicationSidebar /></MemoryRouter>);
    const navigation = screen.getByRole("navigation", { name: "전체 사이트 메뉴" });
    expect(within(navigation).getByRole("button", { name: "코드 작성 보조 메뉴 접기" })).toHaveAttribute("aria-expanded", "true");
    expect(within(navigation).getByRole("link", { name: /SQL Formatter/ })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("button", { name: "API 개발·테스트 메뉴 펼치기" })).toHaveAttribute("aria-expanded", "false");
  });

  it("게임 메뉴는 유틸리티 그룹 아래에 있고, 대전 방으로 들어오면 펼쳐져 온라인 대전을 현재 메뉴로 보여 준다", () => {
    render(<MemoryRouter initialEntries={["/games/online/abcd2345"]}><ApplicationSidebar /></MemoryRouter>);
    const navigation = screen.getByRole("navigation", { name: "전체 사이트 메뉴" });
    const utilityToggle = within(navigation).getByRole("button", { name: /각종 유틸리티 게시판 메뉴/ });
    const gameToggle = within(navigation).getByRole("button", { name: "게임 메뉴 접기" });
    // DOCUMENT_POSITION_FOLLOWING: 게임 그룹 버튼이 유틸리티 그룹 버튼보다 뒤(아래)에 있다
    expect(utilityToggle.compareDocumentPosition(gameToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(navigation).getByRole("link", { name: /^온라인 대전/ })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: /^게임 홈/ })).toHaveAttribute("href", "/games");
    expect(within(navigation).getByRole("link", { name: /게임 랭킹/ })).toHaveAttribute("href", "/games/rankings");
    // 혼자 하는 게임 화면은 없앴다(직접 만들어 보기는 React 연습으로 옮김)
    expect(within(navigation).queryByRole("link", { name: /테트리스|카드 짝 맞추기|지뢰 찾기/ })).not.toBeInTheDocument();
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
