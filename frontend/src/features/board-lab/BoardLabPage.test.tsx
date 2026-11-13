import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardLabPage } from "./BoardLabPage";

const api = vi.hoisted(() => ({ list: vi.fn(), communityList: vi.fn(), calendarMonth: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), answer: vi.fn(), deleteAnswer: vi.fn() }));
const holidayApi = vi.hoisted(() => ({ month: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("./boardApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("./boardApi")>(), boardApi: api,
}));
vi.mock("./calendarHolidayApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("./calendarHolidayApi")>(), calendarHolidayApi: holidayApi,
}));
const session = vi.hoisted(() => ({ authenticated: true, administrator: true, memberId: 1 }));
vi.mock("@/features/auth/hooks/useAuthSession", () => ({ useAuthSessionQuery: () => ({ data: session, isPending: false }) }));
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
    <Route path="/react/boards" element={<BoardLabPage />} />
    <Route path="/react/boards/:boardType/new" element={<BoardLabPage />} />
    <Route path="/react/boards/:boardType/:postId/edit" element={<BoardLabPage />} />
    <Route path="/react/boards/:boardType/:postId" element={<BoardLabPage />} />
    <Route path="/react/boards/:boardType" element={<BoardLabPage />} />
  </Routes></MemoryRouter>
</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  session.authenticated = true;
  session.administrator = true;
  session.memberId = 1;
  api.create.mockResolvedValue({ postId: 9 });
  api.update.mockResolvedValue({ postId: 9 });
  api.answer.mockResolvedValue({ postId: 9 });
  api.calendarMonth.mockResolvedValue({ content: [], truncated: false });
  holidayApi.month.mockResolvedValue({ content: [], officialDataAvailable: true, supportedYears: [2026, 2027], sourceUrls: [], verifiedAt: "2026-11-13" });
  holidayApi.create.mockResolvedValue(undefined);
  holidayApi.update.mockResolvedValue(undefined);
  holidayApi.delete.mockResolvedValue(undefined);
  api.list.mockResolvedValue({ content: [], pageInformation: { totalElements: 0, totalPages: 0, firstPage: true, lastPage: true } });
  api.communityList.mockResolvedValue({ content: [], pageInformation: { totalElements: 0, totalPages: 0, firstPage: true, lastPage: true } });
  api.detail.mockResolvedValue({ postId: 9, title: "제목", authorName: "작성자", createdAt: "2026-11-09T00:00:00", viewCount: 0,
    contentHtml: "<p>본문</p>", answered: false, canEdit: true, canDelete: true, canAnswer: false, answer: null,
    eventDate: null, eventEndDate: null, versionNumber: 1 });
});
afterEach(() => vi.useRealTimers());

describe("게시판의 계정 전환과 저장 상태", () => {
  it("계정 변경 직후 이전 사용자의 편집 권한이 담긴 상세 캐시를 재사용하지 않는다", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={["/react/boards/general/9"]}>
      <Routes><Route path="/react/boards/:boardType/:postId" element={<BoardLabPage />} /></Routes>
    </MemoryRouter></QueryClientProvider>;
    const view = render(ui());
    expect(await screen.findByRole("link", { name: "수정" })).toBeInTheDocument();
    session.memberId = 2;
    session.administrator = false;
    api.detail.mockReturnValue(new Promise(() => undefined));
    view.rerender(ui());
    expect(screen.queryByRole("link", { name: "수정" })).not.toBeInTheDocument();
    await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(2));
  });

  it("저장 중에는 분류 변경과 중복 제출을 막는다", async () => {
    let finishSave: (value: { postId: number }) => void = () => { throw new Error("저장 요청이 없습니다."); };
    const saveRequest = new Promise<{ postId: number }>((resolve) => { finishSave = resolve; });
    api.create.mockReturnValue(saveRequest);
    renderPage("/react/boards/community/new");
    fireEvent.change(screen.getByLabelText("제목 *"), { target: { value: "저장 대기" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    const form = screen.getByRole("button", { name: "저장" }).closest("form");
    if (!form) throw new Error("글쓰기 폼이 없습니다.");
    fireEvent.submit(form);
    await screen.findByRole("button", { name: "저장 중..." });
    expect(screen.getByLabelText("게시글 분류 *")).toBeDisabled();
    fireEvent.submit(form);
    expect(api.create).toHaveBeenCalledTimes(1);
    await act(async () => { finishSave({ postId: 9 }); await saveRequest; });
    expect(await screen.findByRole("heading", { name: "제목" })).toBeInTheDocument();
  });
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

  it("달력의 기본 기간은 브라우저 현지 날짜의 당일이다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 13, 0, 5));
    renderPage("/react/boards/calendar/new");
    expect(screen.getByLabelText("시작일 (From) *")).toHaveValue("2026-11-13");
    expect(screen.getByLabelText("종료일 (To) *")).toHaveValue("2026-11-13");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "회의" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("CALENDAR", expect.objectContaining({
      eventDate: "2026-11-13", eventEndDate: "2026-11-13",
    })));
  });

  it("선택한 날짜를 기본 기간으로 채우고, 시작일을 비우면 저장하지 않는다", () => {
    renderPage("/react/boards/calendar/new?date=2026-11-12");
    expect(screen.getByLabelText("시작일 (From) *")).toHaveValue("2026-11-12");
    expect(screen.getByLabelText("종료일 (To) *")).toHaveValue("2026-11-12");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "회의" } });
    fireEvent.change(screen.getByLabelText("시작일 (From) *"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByLabelText("시작일 (From) *")).toHaveFocus();
    expect(api.create).not.toHaveBeenCalled();
  });

  it.each(["2026-02-30", "1899-12-31", "2101-01-01"])("URL의 잘못된 날짜 %s 대신 당일을 사용한다", (date) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 13, 0, 5));
    renderPage(`/react/boards/calendar/new?date=${date}`);
    expect(screen.getByLabelText("시작일 (From) *")).toHaveValue("2026-11-13");
    expect(screen.getByLabelText("종료일 (To) *")).toHaveValue("2026-11-13");
  });

  it("종료일이 빠지거나 시작일보다 이전이면 막고 올바른 기간만 저장한다", async () => {
    renderPage("/react/boards/calendar/new?date=2026-11-12");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "행사" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.change(screen.getByLabelText("종료일 (To) *"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByLabelText("종료일 (To) *")).toHaveFocus();
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("종료일 (To) *"), { target: { value: "2026-11-11" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByRole("alert")).toHaveTextContent("종료일은 시작일과 같거나 이후여야 합니다.");
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("종료일 (To) *"), { target: { value: "2026-11-15" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("CALENDAR", expect.objectContaining({ eventDate: "2026-11-12", eventEndDate: "2026-11-15" })));
  });

  it("수정할 때 기존 기간을 유지하고 변경한 종료일을 저장한다", async () => {
    api.detail.mockResolvedValue({ postId: 9, title: "행사", contentHtml: "<p>본문</p>", contentText: "본문",
      eventDate: "2026-11-12", eventEndDate: "2026-11-15", versionNumber: 2, canEdit: true });
    renderPage("/react/boards/calendar/9/edit");
    expect(await screen.findByLabelText("시작일 (From) *")).toHaveValue("2026-11-12");
    expect(screen.getByLabelText("종료일 (To) *")).toHaveValue("2026-11-15");
    fireEvent.change(screen.getByLabelText("종료일 (To) *"), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("CALENDAR", 9, expect.objectContaining({
      eventDate: "2026-11-12", eventEndDate: "2026-12-01", versionNumber: 2,
    })));
  });

  it("종료일이 없는 기존 달력 글은 수정할 때 당일 기간으로 읽는다", async () => {
    api.detail.mockResolvedValue({ postId: 9, title: "기존 일정", contentHtml: "<p>본문</p>",
      eventDate: "2026-11-12", eventEndDate: null, canEdit: true });
    renderPage("/react/boards/calendar/9/edit");
    expect(await screen.findByLabelText("시작일 (From) *")).toHaveValue("2026-11-12");
    expect(screen.getByLabelText("종료일 (To) *")).toHaveValue("2026-11-12");
  });

  it("달력 월 조회 결과를 날짜 칸에 연결한다", async () => {
    api.calendarMonth.mockResolvedValueOnce({ content: [{ postId: 4, title: "회의", eventDate: "2026-11-12" }], truncated: false });
    renderPage("/react/boards/calendar?month=2026-11");
    expect(await screen.findByRole("link", { name: "회의" })).toHaveAttribute("href", "/react/boards/calendar/4");
    expect(screen.getByRole("link", { name: "11월 12일 글쓰기" })).toHaveAttribute("href", "/react/boards/calendar/new?date=2026-11-12");
  });

  it("월 경계를 넘는 기간을 현재 월과 겹치는 모든 날짜에 표시한다", async () => {
    api.calendarMonth.mockResolvedValue({ content: [
      { postId: 4, title: "연속 행사", eventDate: "2026-10-30", eventEndDate: "2026-11-02" },
      { postId: 5, title: "다음 달 행사", eventDate: "2026-11-30", eventEndDate: "2026-12-02" },
    ], truncated: false });
    renderPage("/react/boards/calendar?month=2026-11");
    expect(await screen.findAllByRole("link", { name: "연속 행사" })).toHaveLength(2);
    expect(within(screen.getByLabelText("11월 1일, 글 1건")).getByRole("link", { name: "연속 행사" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("11월 2일, 글 1건")).getByRole("link", { name: "연속 행사" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "다음 달 행사" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    await waitFor(() => expect(api.calendarMonth).toHaveBeenCalledWith("2026-12", "", expect.any(AbortSignal)));
    expect(await screen.findAllByRole("link", { name: "다음 달 행사" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "연속 행사" })).not.toBeInTheDocument();
  });

  it("일반·공지·Q&A를 통합 탭과 분류 선택으로 제공한다", () => {
    renderPage("/react/boards/general");
    const navigation = screen.getByRole("navigation", { name: "게시판 종류" });
    expect(within(navigation).getByRole("link", { name: "통합 게시판" })).toHaveAttribute("href", "/react/boards/community");
    expect(within(navigation).queryByRole("link", { name: "공지 게시판" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "게시글 분류" })).toHaveValue("GENERAL");
    fireEvent.click(screen.getByText("게시판별 기능 차이"));
    expect(screen.getByText(/관리자만 작성·수정·삭제하며/)).toBeVisible();
    expect(screen.getByText(/답변 대기·완료 상태를 확인/)).toBeVisible();
  });

  it("일반 회원이 공지 목록에서 글쓰기를 열면 일반 분류로 시작한다", async () => {
    session.administrator = false;
    renderPage("/react/boards/notice");
    await waitFor(() => expect(api.communityList).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute("href", "/react/boards/community/new");
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

  it("하나의 작성 화면에서 분류를 바꾸면 공지 옵션과 질문 안내가 바뀌고 본문을 유지한다", async () => {
    renderPage("/react/boards/community/new");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "분류 선택 글" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.change(screen.getByRole("combobox", { name: "게시글 분류 *" }), { target: { value: "NOTICE" } });
    expect(screen.getByRole("heading", { name: "새 공지" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "목록 상단에 고정" }));
    fireEvent.change(screen.getByRole("combobox", { name: "게시글 분류 *" }), { target: { value: "QNA" } });
    expect(screen.getByRole("heading", { name: "새 질문" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "목록 상단에 고정" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("QNA", expect.objectContaining({
      title: "분류 선택 글", contentText: "본문", pinned: false,
    })));
  });

  it("일반 회원은 작성 분류에서 공지를 선택할 수 없다", () => {
    session.administrator = false;
    renderPage("/react/boards/community/new");
    expect(screen.getByRole("option", { name: "공지" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Q&A" })).not.toBeDisabled();
  });

  it("기존 공지 주소에서 전체 분류로 바꾸면 통합 목록을 서버에서 다시 조회한다", async () => {
    renderPage("/react/boards/notice?keyword=검색&page=2");
    await waitFor(() => expect(api.communityList).toHaveBeenCalledWith("NOTICE", "검색", 2, expect.any(AbortSignal)));
    fireEvent.change(screen.getByRole("combobox", { name: "게시글 분류" }), { target: { value: "" } });
    await waitFor(() => expect(api.communityList).toHaveBeenCalledWith(undefined, "검색", 0, expect.any(AbortSignal)));
  });

  it("통합 목록에 분류와 답변 상태를 표시하고 기존 글 상세 주소를 유지한다", async () => {
    api.communityList.mockResolvedValue({ content: [
      { postId: 2, boardType: "NOTICE", title: "공지 글", pinned: true, createdAt: "2026-11-13" },
      { postId: 3, boardType: "QNA", title: "질문 글", answered: true, createdAt: "2026-11-13" },
    ], pageInformation: { totalElements: 2, totalPages: 1 } });
    renderPage("/react/boards");
    expect(await screen.findByRole("link", { name: /공지 글/ })).toHaveAttribute("href", "/react/boards/notice/2");
    expect(screen.getByRole("link", { name: /질문 글/ })).toHaveAttribute("href", "/react/boards/qna/3");
    expect(screen.getByText("답변 완료")).toBeInTheDocument();
  });

  it("팝업에 메뉴·하위 경로·노출 사용·기간을 저장한다", async () => {
    renderPage("/react/boards/popup/new");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "점검 안내" } });
    fireEvent.click(screen.getByRole("button", { name: "본문 입력 예시" }));
    fireEvent.change(screen.getByLabelText("표시할 메뉴 URL *"), { target: { value: "/utilities/" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "하위 경로에서도 표시" }));
    fireEvent.change(screen.getByLabelText("시작일 (From) *"), { target: { value: "2026-11-13" } });
    fireEvent.change(screen.getByLabelText("종료일 (To) *"), { target: { value: "2026-11-15" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("POPUP", expect.objectContaining({
      popup: { targetPath: "/utilities", includeChildren: true, enabled: true },
      eventDate: "2026-11-13", eventEndDate: "2026-11-15",
    })));
  });

  it("팝업은 외부 URL을 막고 해당 입력칸으로 포커스한다", () => {
    renderPage("/react/boards/popup/new");
    fireEvent.change(screen.getByRole("textbox", { name: "제목 *" }), { target: { value: "안내" } });
    fireEvent.change(screen.getByLabelText("표시할 메뉴 URL *"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByLabelText("표시할 메뉴 URL *")).toHaveFocus();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("일반 회원에게 팝업 관리 목록을 요청하지 않는다", () => {
    session.administrator = false;
    renderPage("/react/boards/popup");
    expect(screen.getByRole("alert")).toHaveTextContent("팝업 관리는 관리자만 이용할 수 있습니다.");
    expect(api.list).not.toHaveBeenCalled();
  });

  it("권한이 없는 사용자는 팝업 상세를 요청하거나 표시하지 않는다", () => {
    session.administrator = false;
    renderPage("/react/boards/popup/9");
    expect(screen.getByRole("alert")).toHaveTextContent("팝업 관리는 관리자만 이용할 수 있습니다.");
    expect(api.detail).not.toHaveBeenCalled();
  });

  it("작성 URL의 잘못된 분류를 일반 글로 바꾸어 저장하지 않는다", () => {
    renderPage("/react/boards/community/new?category=POPUP");
    expect(screen.getByRole("alert")).toHaveTextContent("게시글 분류가 올바르지 않습니다.");
    expect(screen.queryByRole("button", { name: "저장" })).not.toBeInTheDocument();
  });

  it("API 갱신 실패에도 저장된 휴일과 출처·확인일을 표시한다", async () => {
    holidayApi.month.mockResolvedValue({ content: [
      { date: "2028-05-05", name: "어린이날", kind: "PUBLIC", official: true, holidayId: null, versionNumber: null },
    ], officialDataAvailable: true, supportedYears: [2026, 2027, 2028], sourceUrls: [], verifiedAt: "2026-11-12",
    source: "CACHE", warning: "공휴일 API 갱신에 실패했습니다. 마지막으로 확인한 자료를 표시합니다." });
    renderPage("/react/boards/calendar?month=2028-05");
    expect(await screen.findByText("어린이날")).toBeInTheDocument();
    expect(screen.getByText(/공휴일 API 갱신에 실패했습니다/)).toBeInTheDocument();
    expect(screen.getByText(/공공데이터 저장 자료 · 공휴일 자료 확인일: 2026-11-12/)).toBeInTheDocument();
  });

  it("공휴일·대체공휴일 이름을 표시하고 게시글 검색에도 유지한다", async () => {
    holidayApi.month.mockResolvedValue({ content: [
      { date: "2026-05-24", name: "부처님오신날", kind: "PUBLIC", official: true, holidayId: null },
      { date: "2026-05-25", name: "대체공휴일(부처님오신날)", kind: "SUBSTITUTE", official: true, holidayId: null },
    ], officialDataAvailable: true, supportedYears: [2026, 2027], sourceUrls: [], verifiedAt: "2026-11-13" });
    renderPage("/react/boards/calendar?month=2026-05");
    expect(await screen.findByText("대체공휴일(부처님오신날)")).toBeInTheDocument();
    expect(screen.getByLabelText("5월 25일, 글 0건, 대체공휴일(부처님오신날)")).toHaveClass("board-lab-day-holiday");
    fireEvent.change(screen.getByLabelText("제목·내용 검색"), { target: { value: "회의" } });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    await waitFor(() => expect(api.calendarMonth).toHaveBeenCalledWith("2026-05", "회의", expect.any(AbortSignal)));
    expect(screen.getByText("대체공휴일(부처님오신날)")).toBeInTheDocument();
    expect(holidayApi.month).toHaveBeenCalledTimes(1);
  });

  it("공식 자료가 없는 연도는 안내하고 직접 추가한 회사 휴무일을 표시한다", async () => {
    session.administrator = false;
    holidayApi.month.mockResolvedValue({ content: [
      { holidayId: 1, date: "2030-11-13", name: "창립기념일", kind: "COMPANY", official: false, versionNumber: 1 },
    ], officialDataAvailable: false, supportedYears: [2026, 2027], sourceUrls: [], verifiedAt: null });
    renderPage("/react/boards/calendar?month=2030-11");
    expect(await screen.findByText(/2030년 공식 공휴일 자료가 아직 등록되지 않았습니다/)).toBeInTheDocument();
    expect(screen.getByText("휴무 · 창립기념일")).toBeInTheDocument();
    expect(screen.queryByText("휴일 관리")).not.toBeInTheDocument();
  });

  it("게시글 조회가 실패해도 공휴일 달력은 유지하고 휴일 오류는 별도로 재시도한다", async () => {
    api.calendarMonth.mockRejectedValue(new Error("posts failed"));
    holidayApi.month.mockRejectedValueOnce(new Error("holidays failed"));
    renderPage("/react/boards/calendar?month=2026-11");
    fireEvent.click(await screen.findByRole("button", { name: "공휴일 다시 시도" }));
    await waitFor(() => expect(holidayApi.month).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("region", { name: "2026년 11월 게시글 달력" })).toBeInTheDocument();
    expect(await screen.findByText("휴일 관리")).toBeInTheDocument();
  });
});
