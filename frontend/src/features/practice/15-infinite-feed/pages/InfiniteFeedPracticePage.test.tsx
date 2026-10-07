import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { getFeedPage, type FeedPage } from "@/features/practice/15-infinite-feed/api/localFeedApi";
import { InfiniteFeedPracticePage } from "./InfiniteFeedPracticePage";

vi.mock("@/features/practice/15-infinite-feed/api/localFeedApi", () => ({ getFeedPage: vi.fn() }));
const mockedGetFeedPage = vi.mocked(getFeedPage);

const createPage = (from: number, count: number, nextCursor: number | null): FeedPage => ({
  items: Array.from({ length: count }, (_, index) => ({
    postId: from + index, title: `${from + index}번 글`, authorName: "김리액트", summary: "요약",
  })),
  nextCursor,
});

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><InfiniteFeedPracticePage /></MemoryRouter>
  </QueryClientProvider>,
);

describe("InfiniteFeedPracticePage", () => {
  // 중괄호로 감싼다. mockReset()은 mock 함수를 돌려주는데, beforeEach가 함수를 돌려받으면
  // Vitest가 그것을 "테스트 뒤 정리 함수"로 보고 인자 없이 호출해 버린다.
  beforeEach(() => {
    mockedGetFeedPage.mockReset();
  });

  it("다음 커서로 묶음을 이어 붙이고 마지막 묶음 뒤에는 더 보기를 숨긴다", async () => {
    mockedGetFeedPage.mockImplementation(({ cursor }) => Promise.resolve(cursor === 0 ? createPage(1, 2, 2) : createPage(3, 1, null)));
    renderPage();

    expect(await screen.findByText("1번 글")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("3번 글")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "피드 글 목록" })).getAllByRole("listitem")).toHaveLength(3);
    expect(mockedGetFeedPage).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 2 }));
    expect(screen.getByText("모든 글을 불러왔습니다. (총 3건)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("검색어를 바꾸면 처음 묶음부터 다시 받고 실패하면 다시 시도할 수 있다", async () => {
    mockedGetFeedPage.mockImplementation(({ keyword }) => keyword === "error"
      ? Promise.reject(new Error("연습용 실패"))
      : Promise.resolve(createPage(1, 1, null)));
    renderPage();
    await screen.findByText("1번 글");

    fireEvent.change(screen.getByRole("textbox", { name: "피드 검색" }), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("연습용 실패");
    expect(mockedGetFeedPage).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 0, keyword: "error" }));
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
