import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleProtectedRoute } from "./RoleProtectedRoute";

// 테스트마다 로그인 상태를 바꿀 수 있게 hoisted 객체에 담는다.
const sessionState = vi.hoisted(() => ({ superAdministrator: false }));

vi.mock("@/features/auth/hooks/useAuthSession", () => ({
  useAuthSessionQuery: () => ({
    isPending: false,
    data: { superAdministrator: sessionState.superAdministrator, administrator: sessionState.superAdministrator },
  }),
}));

const renderCrawlerRoute = () => render(
  <MemoryRouter initialEntries={["/utilities/crawler"]}>
    <Routes>
      <Route path="/" element={<p>홈 화면</p>} />
      <Route path="/utilities/crawler" element={
        <RoleProtectedRoute superAdminOnly fallback={<p role="alert">슈퍼관리자만 사용할 수 있습니다.</p>}>
          <p>크롤러 화면</p>
        </RoleProtectedRoute>
      } />
    </Routes>
  </MemoryRouter>,
);

describe("RoleProtectedRoute", () => {
  beforeEach(() => {
    sessionState.superAdministrator = false;
  });

  it("fallback을 주면 권한이 없을 때 홈으로 보내지 않고 안내를 보여 준다", () => {
    renderCrawlerRoute();

    expect(screen.getByRole("alert")).toHaveTextContent("슈퍼관리자만 사용할 수 있습니다.");
    expect(screen.queryByText("홈 화면")).not.toBeInTheDocument();
    expect(screen.queryByText("크롤러 화면")).not.toBeInTheDocument();
  });

  it("슈퍼관리자에게는 원래 화면을 보여 준다", () => {
    sessionState.superAdministrator = true;
    renderCrawlerRoute();

    expect(screen.getByText("크롤러 화면")).toBeInTheDocument();
  });
});
