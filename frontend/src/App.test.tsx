/**
 * App.tsx 라우팅 테스트 — 옛 주소가 새 주소로 넘어가는지 확인한다.
 *
 * App은 BrowserRouter를 쓰므로 MemoryRouter 대신 window.history로 시작 주소를 정한다.
 * 이 테스트와 상관없는 서버 호출(방문 기록·로그인 확인·방 목록)은 가짜 컴포넌트로 바꿔 둔다.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/App";

// 테스트에는 .env 값이 없으므로 환경변수 모듈을 고정값으로 바꾼다(HttpClient.test.ts와 같은 방법)
vi.mock("@/shared/config/applicationEnvironment", () => ({
  applicationEnvironment: {
    VITE_API_BASE_URL: "/api/v1", VITE_HTTP_CLIENT: "axios", VITE_DATA_SOURCE: "backend", VITE_MOCK_SCENARIO: "success",
    VITE_DEVELOPMENT_MEMBER_ID: "1", VITE_ENABLE_DEVELOPMENT_MENU: "false",
  },
}));
vi.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));
vi.mock("@/app/components/VisitTracker", () => ({ VisitTracker: () => null }));
vi.mock("@/features/portfolio/layouts/PortfolioLayout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { PortfolioLayout: () => <Outlet /> };
});
vi.mock("@/features/games/online/pages/OnlineLobbyPage", () => ({ OnlineLobbyPage: () => <p>온라인 대전 대기실</p> }));

describe("App 옛 주소 리다이렉트", () => {
  it.each(["/games/memory", "/games/2048", "/games/minesweeper", "/games/tetris"])(
    "없앤 혼자 하는 게임 화면 %s는 온라인 대전 대기실로 바꿔 보낸다(뒤로 가기 기록을 남기지 않음)",
    async (oldPath) => {
      window.history.replaceState(null, "", oldPath);
      const historyLength = window.history.length;
      render(<App />);
      expect(await screen.findByText("온라인 대전 대기실")).toBeInTheDocument();
      expect(window.location.pathname).toBe("/games/online");
      expect(window.history.length).toBe(historyLength);
    },
  );
});
