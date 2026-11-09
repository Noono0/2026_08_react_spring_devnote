import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoardLabPage } from "./BoardLabPage";

const api = vi.hoisted(() => ({ list: vi.fn(), calendarMonth: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), answer: vi.fn(), deleteAnswer: vi.fn() }));
vi.mock("./boardApi", () => ({
  boardApi: api,
  boardTypes: ["GENERAL", "NOTICE", "QNA", "GALLERY", "GRID", "CALENDAR"],
  boardLabels: { GENERAL: "일반 게시판", NOTICE: "공지 게시판", QNA: "Q&A 게시판", GALLERY: "갤러리 게시판", GRID: "그리드 게시판", CALENDAR: "달력 게시판" },
  parseBoardType: (value: string) => ["GENERAL", "NOTICE", "QNA", "GALLERY", "GRID", "CALENDAR"].find((type) => type.toLowerCase() === value?.toLowerCase()),
}));
vi.mock("@/features/auth/hooks/useAuthSession", () => ({ useAuthSessionQuery: () => ({ data: { authenticated: true, administrator: true }, isPending: false }) }));
vi.mock("@/features/rich-text-editor/components/RichTextEditor", () => ({
  RichTextEditor: ({ editorLabel, handleContentChange }: { editorLabel: string; handleContentChange: (content: unknown) => void }) =>
    <div><span>{editorLabel}</span><button type="button" onClick={() => handleContentChange({
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }] },
      contentHtml: "<p>본문</p>", contentText: "본문",
    })}>본문 입력 예시</button></div>,
}));
vi.mock("@/features/file/components/ThumbnailImageUploader", () => ({ ThumbnailImageUploader: () => <div>대표 이미지 업로드</div> }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: { success: vi.fn(), apiError: vi.fn() } }));

const renderPage = (path: string) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/react/boards/:boardType/new" element={<BoardLabPage />} />
    <Route path="/react/boards/:boardType/:postId" element={<BoardLabPage />} />
    <Route path="/react/boards/:boardType" element={<BoardLabPage />} />
  </Routes></MemoryRouter>
</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  api.create.mockResolvedValue({ postId: 9 });
  api.answer.mockResolvedValue({ postId: 9 });
  api.calendarMonth.mockResolvedValue({ content: [], truncated: false });
  api.list.mockResolvedValue({ content: [], pageInformation: { totalElements: 0, totalPages: 0, firstPage: true, lastPage: true } });
  api.detail.mockResolvedValue({ postId: 9, title: "제목", authorName: "작성자", createdAt: "2026-11-09T00:00:00", viewCount: 0,
    contentHtml: "<p>본문</p>", answered: false, canEdit: true, canDelete: true, canAnswer: false, answer: null });
});

describe("통합 게시판 에디터", () => {
  it.each(["general", "notice", "qna", "gallery", "grid", "calendar"])("%s 작성에 공통 에디터를 표시한다", (type) => {
    renderPage(`/react/boards/${type}/new`);
    expect(screen.getByText("게시글 본문")).toBeInTheDocument();
  });

  it("제목 누락 시 제목으로 포커스하고, 본문 세 형태를 저장한다", async () => {
    renderPage("/react/boards/general/new");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByRole("textbox", { name: "제목 *" })).toHaveFocus();
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "테스트 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("GENERAL", expect.objectContaining({
      title: "테스트 제목", contentText: "본문", contentHtml: "<p>본문</p>",
    })));
  });

  it("갤러리는 대표 이미지 없이 저장하지 않는다", () => {
    renderPage("/react/boards/gallery/new");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "사진" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByRole("alert")).toHaveTextContent("대표 이미지를 올려 주세요.");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("달력의 날짜를 글쓰기에 채우고 누락되면 날짜 입력칸으로 이동한다", async () => {
    renderPage("/react/boards/calendar/new");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "회의" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByLabelText("날짜 *")).toHaveFocus();
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("날짜 *"), { target: { value: "2026-11-12" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("CALENDAR", expect.objectContaining({ eventDate: "2026-11-12" })));
  });

  it("달력 월 조회 결과를 날짜 칸에 연결한다", async () => {
    api.calendarMonth.mockResolvedValueOnce({ content: [{ postId: 4, title: "회의", eventDate: "2026-11-12" }], truncated: false });
    renderPage("/react/boards/calendar?month=2026-11");
    expect(await screen.findByRole("link", { name: "회의" })).toHaveAttribute("href", "/react/boards/calendar/4");
    expect(screen.getByRole("link", { name: "11월 12일 글쓰기" })).toHaveAttribute("href", "/react/boards/calendar/new?date=2026-11-12");
  });

  it("Q&A 답변도 공통 에디터의 JSON·HTML·텍스트로 등록한다", async () => {
    api.detail.mockResolvedValueOnce({ postId: 9, title: "질문", authorName: "작성자", createdAt: "2026-11-09T00:00:00", viewCount: 0,
      contentHtml: "<p>질문</p>", answered: false, canEdit: false, canDelete: false, canAnswer: true, answer: null });
    renderPage("/react/boards/qna/9");
    expect(await screen.findByText("Q&A 답변")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.click(screen.getByRole("button", { name: "답변 등록" }));
    await waitFor(() => expect(api.answer).toHaveBeenCalledWith(9, expect.objectContaining({
      contentText: "본문", contentHtml: "<p>본문</p>",
    })));
  });
});
