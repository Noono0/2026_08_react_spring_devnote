import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHistoryList, getHistoryTags } from "../api/historyApi";
import type { HistoryListResponse } from "../types/historyTypes";
import { HistoryListPage } from "./HistoryListPage";

// 이 화면은 로그인 세션 중 superAdministrator만 읽는다. 테스트마다 값을 바꿀 수 있게 hoisted 객체에 담는다.
const authenticationState = vi.hoisted(() => ({ superAdministrator: false }));

vi.mock("@/features/auth/hooks/useAuthSession", () => ({
  useAuthSessionQuery: () => ({ data: { superAdministrator: authenticationState.superAdministrator } }),
}));
vi.mock("@/features/help/FeatureHelpButton", () => ({ FeatureHelpButton: () => null }));
vi.mock("../api/historyApi", () => ({ getHistoryList: vi.fn(), getHistoryTags: vi.fn() }));

const mockedGetHistoryList = vi.mocked(getHistoryList);
const mockedGetHistoryTags = vi.mocked(getHistoryTags);

const historyListResponse: HistoryListResponse = {
  content: [{
    documentId: 101,
    documentTitle: "Nginx 업로드 한도 정리",
    documentStatus: "PUBLISHED",
    versionNumber: 1,
    viewCount: 3,
    authorId: 1,
    authorName: "관리자",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    tags: ["배포"],
  }],
  pageInformation: { pageNumber: 0, pageSize: 10, totalElements: 1, totalPages: 1, firstPage: true, lastPage: true },
};

const mockAuthSession = (superAdministrator: boolean) => {
  authenticationState.superAdministrator = superAdministrator;
};

const renderHistoryListPage = (initialEntry = "/history") => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initialEntry]}><HistoryListPage /></MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetHistoryList.mockResolvedValue(historyListResponse);
  mockedGetHistoryTags.mockResolvedValue([{ tagName: "배포", documentCount: 1 }]);
});

describe("HistoryListPage", () => {
  it("방문자는 주소에 임시저장 상태를 넣어도 발행 글만 요청하고 작성 버튼을 보지 못한다", async () => {
    mockAuthSession(false);
    renderHistoryListPage("/history?documentStatus=DRAFT");

    expect(await screen.findByRole("link", { name: "Nginx 업로드 한도 정리" })).toHaveAttribute("href", "/history/101");
    expect(mockedGetHistoryList).toHaveBeenCalledWith(expect.objectContaining({ documentStatus: "PUBLISHED" }), expect.anything());
    expect(screen.queryByRole("link", { name: "History 작성" })).not.toBeInTheDocument();
    // 학습 단계 화면이 아니라 포트폴리오 화면이므로 학습 단계 제목을 쓰지 않는다.
    expect(screen.getByRole("heading", { level: 1, name: "나의 업무 History" })).toBeInTheDocument();
  });

  it("슈퍼관리자는 주소의 상태 조건 그대로 조회하고 작성 버튼을 본다", async () => {
    mockAuthSession(true);
    renderHistoryListPage("/history?documentStatus=DRAFT");

    expect(await screen.findByRole("link", { name: "History 작성" })).toHaveAttribute("href", "/history/new");
    await waitFor(() => expect(mockedGetHistoryList).toHaveBeenCalledWith(expect.objectContaining({ documentStatus: "DRAFT" }), expect.anything()));
    expect(await screen.findByRole("button", { name: /#배포/ })).toBeInTheDocument();
  });
});
