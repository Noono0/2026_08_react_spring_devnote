import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOnlineRanking, getSoloRanking } from "./rankingApi";
import { GameRankingPage } from "./GameRankingPage";
import { periodForPreset } from "./rankingPeriod";

vi.mock("./rankingApi", () => ({ getOnlineRanking: vi.fn(), getSoloRanking: vi.fn() }));
const mockedGetOnlineRanking = vi.mocked(getOnlineRanking);
const mockedGetSoloRanking = vi.mocked(getSoloRanking);

const renderPage = (initialEntry = "/games/rankings") => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initialEntry]}><GameRankingPage /></MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  mockedGetOnlineRanking.mockReset();
  mockedGetSoloRanking.mockReset();
  mockedGetOnlineRanking.mockResolvedValue([
    { rank: 1, playerName: "김회원", member: true, wins: 3, plays: 4, winRate: 0.75 },
    { rank: 2, playerName: "철수", member: false, wins: 1, plays: 3, winRate: 1 / 3 },
  ]);
  mockedGetSoloRanking.mockResolvedValue([]);
});

describe("GameRankingPage", () => {
  it("처음에는 오목의 이번 달 랭킹을 보여 주고, 비회원은 표시가 붙는다", async () => {
    renderPage();
    const table = await screen.findByRole("table");
    expect(mockedGetOnlineRanking).toHaveBeenCalledWith("OMOK", periodForPreset("MONTH"));
    expect(screen.getByRole("button", { name: "이번 달" })).toHaveAttribute("aria-pressed", "true");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("김회원");
    expect(rows[1]).toHaveTextContent("75%");
    expect(rows[2]).toHaveTextContent("철수비회원");
    expect(rows[2]).toHaveTextContent("33%");
  });

  it("기간 버튼을 누르면 바로 그 기간으로 다시 불러온다", async () => {
    renderPage();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    await waitFor(() => expect(mockedGetOnlineRanking).toHaveBeenLastCalledWith("OMOK", { from: null, to: null }));
    fireEvent.click(screen.getByRole("button", { name: "이번 주" }));
    await waitFor(() => expect(mockedGetOnlineRanking).toHaveBeenLastCalledWith("OMOK", periodForPreset("WEEK")));
    expect(screen.getByLabelText("시작일")).toHaveValue(periodForPreset("WEEK").from);
  });

  it("시작일이 종료일보다 늦으면 알리고 서버에 묻지 않는다", async () => {
    renderPage();
    await screen.findByRole("table");
    mockedGetOnlineRanking.mockClear();
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-01-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("시작일은 종료일보다 늦을 수 없습니다.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(mockedGetOnlineRanking).not.toHaveBeenCalledWith("OMOK", { from: "2026-12-31", to: "2026-01-01" });
  });

  it("주소의 종목·난이도로 열고, 기록이 없으면 빈 결과를 알린다", async () => {
    renderPage("/games/rankings?game=solo:MINESWEEPER&difficulty=EXPERT");
    expect(await screen.findByText(/이 기간에는 기록이 없습니다/)).toBeInTheDocument();
    expect(mockedGetSoloRanking).toHaveBeenCalledWith("MINESWEEPER", "EXPERT", periodForPreset("MONTH"));
    expect(screen.getByRole("combobox", { name: "종목" })).toHaveValue("solo:MINESWEEPER");
    expect(screen.getByRole("button", { name: /고급/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "지뢰 찾기 하러 가기" })).toHaveAttribute("href", "/games/online");
  });

  it("스도쿠 랭킹은 난이도마다 조회하고, 하러 가기는 온라인 대전으로 안내한다", async () => {
    renderPage("/games/rankings?game=solo:SUDOKU&difficulty=HARD");
    expect(await screen.findByText(/이 기간에는 기록이 없습니다/)).toBeInTheDocument();
    expect(mockedGetSoloRanking).toHaveBeenCalledWith("SUDOKU", "HARD", periodForPreset("MONTH"));
    expect(screen.getByRole("button", { name: /어려움/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "스도쿠 하러 가기" })).toHaveAttribute("href", "/games/online");
  });

  it("목록에 없는 종목·난이도가 주소에 오면 기본값을 쓴다", async () => {
    renderPage("/games/rankings?game=solo:MINESWEEPER&difficulty=HACK");
    await screen.findByText(/이 기간에는 기록이 없습니다/);
    expect(mockedGetSoloRanking).toHaveBeenCalledWith("MINESWEEPER", "BEGINNER", periodForPreset("MONTH"));

    renderPage("/games/rankings?game=unknown");
    await waitFor(() => expect(mockedGetOnlineRanking).toHaveBeenCalledWith("OMOK", periodForPreset("MONTH")));
  });

  it("종목을 바꾸면 그 게임의 첫 난이도 랭킹을 불러온다", async () => {
    renderPage();
    await screen.findByRole("table");
    fireEvent.change(screen.getByRole("combobox", { name: "종목" }), { target: { value: "solo:MEMORY" } });
    await waitFor(() => expect(mockedGetSoloRanking).toHaveBeenCalledWith("MEMORY", "EASY", periodForPreset("MONTH")));
  });

  it("불러오지 못하면 오류를 알린다", async () => {
    mockedGetOnlineRanking.mockRejectedValue(new Error("network"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("랭킹을 불러오지 못했습니다.");
  });
});
