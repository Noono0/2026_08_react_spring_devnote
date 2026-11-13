import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PopupDisplay } from "./PopupDisplay";

const api = vi.hoisted(() => ({ activePopups: vi.fn() }));
vi.mock("./boardApi", () => ({ boardApi: api }));
vi.mock("@/shared/ui/ModalDialog", () => ({
  ModalDialog: ({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) =>
    <section role="dialog" aria-label={title}>{children}{footer}</section>,
}));
const notice = { postId: 1, title: "점검 안내", contentHtml: "<p>안내 본문</p>", versionNumber: 1, endDate: "2026-11-13" };
const renderPopup = (path = "/react") => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter initialEntries={[path]}><PopupDisplay /><Link to="/utilities">다른 메뉴</Link><Link to="/react?keyword=next">검색 조건 변경</Link></MemoryRouter>
</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T01:00:00Z"));
  api.activePopups.mockResolvedValue([notice]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("메뉴·기간별 팝업", () => {
  it("현재 메뉴로 조회한 제목과 본문을 표시하고 닫는다", async () => {
    renderPopup();
    expect(await screen.findByRole("dialog", { name: "점검 안내" })).toHaveTextContent("안내 본문");
    expect(api.activePopups).toHaveBeenCalledWith("/react", expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "검색 조건 변경" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("여러 팝업은 하나씩 표시하고 다른 메뉴로 이동하면 새 경로로 조회한다", async () => {
    api.activePopups.mockResolvedValue([notice, { ...notice, postId: 2, title: "두 번째 안내" }]);
    renderPopup();
    await screen.findByRole("dialog", { name: "점검 안내" });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.getByRole("dialog", { name: "두 번째 안내" })).toBeInTheDocument();
    api.activePopups.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("link", { name: "다른 메뉴" }));
    await waitFor(() => expect(api.activePopups).toHaveBeenCalledWith("/utilities", expect.any(AbortSignal)));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("기간이 끝난 응답은 숨기고 HTML의 실행 코드를 제거한다", async () => {
    api.activePopups.mockResolvedValue([
      { ...notice, postId: 2, title: "종료 안내", endDate: "2026-11-12" },
      { ...notice, contentHtml: '<p>안내 본문</p><script>bad()</script><img src="x" onerror="bad()">' },
    ]);
    const { container } = renderPopup();
    await screen.findByRole("dialog", { name: "점검 안내" });
    expect(screen.queryByRole("dialog", { name: "종료 안내" })).not.toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("한국 시간 자정이 되면 열린 팝업도 만료 처리한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T14:59:59Z"));
    renderPopup();
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(screen.getByRole("dialog", { name: "점검 안내" })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("팝업 관리 메뉴에서는 자동 팝업을 열지 않는다", () => {
    renderPopup("/react/boards/popup/1/edit");
    expect(api.activePopups).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("백엔드 없이 실행하는 온라인 모의 모드에서는 팝업을 조회하지 않는다", () => {
    vi.stubEnv("VITE_DATA_SOURCE", "mock");
    renderPopup();
    expect(api.activePopups).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("조회 오류를 알리고 다시 시도할 수 있다", async () => {
    api.activePopups.mockRejectedValueOnce(new Error("network"));
    renderPopup();
    expect(await screen.findByRole("status")).toHaveTextContent("안내 팝업을 확인하지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "다시 확인" }));
    expect(await screen.findByRole("dialog", { name: "점검 안내" })).toBeInTheDocument();
  });
});
