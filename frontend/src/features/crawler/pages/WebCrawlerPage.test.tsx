import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteNaverCrawlerSession,
  getCrawlerConfigurations,
  getCrawlerLiveView,
  getCrawlerRunHistories,
  getCrawlerRunHistory,
  getNaverCrawlerSessionStatus,
  runWebCrawler,
} from "@/features/crawler/api/webCrawlerApi";
import type { CrawlerConfiguration } from "@/features/crawler/types/webCrawlerTypes";
import { WebCrawlerPage } from "./WebCrawlerPage";
import { downloadText } from "@/features/utility/utils/browserFileUtils";

vi.mock("@/features/utility/utils/browserFileUtils", () => ({ downloadText: vi.fn() }));

vi.mock("@/features/crawler/api/webCrawlerApi", () => ({
  runWebCrawler: vi.fn(),
  getNaverCrawlerSessionStatus: vi.fn(),
  deleteNaverCrawlerSession: vi.fn(),
  getCrawlerConfigurations: vi.fn(),
  getCrawlerLiveView: vi.fn(),
  closeCrawlerLiveView: vi.fn(),
  startCrawlerRecording: vi.fn(),
  stopCrawlerRecording: vi.fn(),
  sendCrawlerManualAction: vi.fn(),
  createCrawlerConfiguration: vi.fn(),
  updateCrawlerConfiguration: vi.fn(),
  deleteCrawlerConfiguration: vi.fn(),
  runCrawlerConfiguration: vi.fn(),
  getCrawlerRunHistories: vi.fn(),
  getCrawlerRunHistory: vi.fn(),
  deleteCrawlerRunHistory: vi.fn(),
}));

const mockedRunWebCrawler = vi.mocked(runWebCrawler);
const mockedGetNaverSessionStatus = vi.mocked(getNaverCrawlerSessionStatus);
const mockedDeleteNaverSession = vi.mocked(deleteNaverCrawlerSession);
const mockedGetCrawlerConfigurations = vi.mocked(getCrawlerConfigurations);
const mockedGetCrawlerLiveView = vi.mocked(getCrawlerLiveView);
const mockedGetCrawlerRunHistories = vi.mocked(getCrawlerRunHistories);
const mockedGetCrawlerRunHistory = vi.mocked(getCrawlerRunHistory);

const savedNaverConfiguration: CrawlerConfiguration = {
  configurationId: 7, title: "LH 매물 수집", description: "2호선 주변", sitePreset: "NAVER_CAFE",
  runCount: 2, lastRunStatus: "SUCCESS", lastRunAt: "2026-09-20T00:00:00Z",
  createdAt: "2026-09-20T00:00:00Z", updatedAt: "2026-09-20T00:00:00Z",
  request: {
    showBrowser: true, browserWindow: "WEB", steps: [], collectDetail: false, detailSelector: "", parseListing: false,
    startUrl: "https://cafe.naver.com/lhuniv9",
    login: { mode: "FORM", loginUrl: "https://nid.naver.com/nidlogin.login?mode=form", username: "", password: "", usernameSelector: "#id", passwordSelector: "#pw", submitSelector: "#loginBtn_column:visible, #loginBtn_row:visible", loggedInSelector: "" },
    pageSearch: { enabled: true, keyword: "LH", inputSelector: "#topLayerQueryInput", submitSelector: "" },
    contentFrameSelector: "iframe#cafe_main", itemSelector: "div.article-board tbody tr",
    fields: [{ name: "제목", selector: "a.article", valueSource: "TEXT", attributeName: "" }],
    collectionFilter: { groupMatchMode: "ALL", groups: [{ matchMode: "ANY", keywords: ["신림", "봉천"] }] },
    nextPageSelector: "", maxPages: 3, waitAfterNavigationMillis: 1500, maxItems: 100,
  },
};

const renderPage = (openEditor = true) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(<QueryClientProvider client={queryClient}><WebCrawlerPage /></QueryClientProvider>);
  if (openEditor) fireEvent.click(screen.getByRole("button", { name: "+ 새 설정" }));
  return result;
};

describe("WebCrawlerPage", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.mocked(downloadText).mockClear();
    mockedRunWebCrawler.mockReset();
    mockedGetNaverSessionStatus.mockReset();
    mockedGetNaverSessionStatus.mockResolvedValue({ available: false, updatedAt: null });
    mockedDeleteNaverSession.mockReset();
    mockedDeleteNaverSession.mockResolvedValue({ available: false, updatedAt: null });
    mockedGetCrawlerConfigurations.mockReset();
    mockedGetCrawlerConfigurations.mockResolvedValue([]);
    mockedGetCrawlerLiveView.mockResolvedValue({
      active: false, stage: "대기 중", imageDataUrl: "", updatedAt: "2026-09-20T00:00:00Z",
      pauseRequested: false, collectedCount: 0, logs: [],
      manualActionRequired: false, manualActionMessage: "",
      runStatus: "IDLE", finalReason: "", suggestedAction: "", inspecting: false, directWindow: false, steps: [], recording: false, recordedSteps: [],
    });
    mockedGetCrawlerRunHistories.mockReset();
    mockedGetCrawlerRunHistories.mockResolvedValue([]);
    window.localStorage.clear();
  });

  it("처음에는 설정 목록만 보이고 새 설정을 누르면 입력 화면을 연다", () => {
    renderPage(false);

    expect(screen.getByRole("heading", { name: "크롤링 설정 게시판" })).toBeInTheDocument();
    expect(screen.queryByLabelText("수집할 URL")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ 새 설정" }));
    expect(screen.getByLabelText("수집할 URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "목록으로" })).toBeInTheDocument();
  });

  it("단계 테스트 실행은 설정을 유지하면서 요청만 1페이지·3건으로 제한한다", async () => {
    mockedRunWebCrawler.mockResolvedValue({
      crawledAt: "2026-09-20T00:00:00Z", pageTitle: "테스트", finalUrl: "https://quotes.toscrape.com/",
      crawledPageCount: 1, scannedItemCount: 3, durationMillis: 100, fieldNames: [], items: [], warnings: [],
    });
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: /^단계별 실행/ }));
    fireEvent.click(screen.getByRole("button", { name: "페이지 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "목록 반복" }));
    fireEvent.click(screen.getByRole("button", { name: /테스트 실행/ }));
    await waitFor(() => expect(mockedRunWebCrawler).toHaveBeenCalledTimes(1));
    expect(mockedRunWebCrawler.mock.calls[0]?.[0]).toMatchObject({ maxPages: 1, maxItems: 3, steps: [{ type: "GOTO" }, { type: "COLLECT", fields: [{ name: "문구" }, { name: "작성자" }, { name: "상세URL" }] }] });
    expect(screen.getByLabelText("최대 항목")).toHaveValue(100);
  });

  it("저장과 테스트 실행에서 선택하지 않은 단계의 필수값으로 이동한다", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: /^단계별 실행/ }));
    fireEvent.click(screen.getByRole("button", { name: "페이지 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "요소 클릭" }));
    fireEvent.click(screen.getByRole("button", { name: "목록 반복" }));
    expect(screen.getByText("2개 단계")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "대상 글자" })).toHaveFocus());
    fireEvent.change(screen.getByRole("textbox", { name: "대상 글자" }), { target: { value: "검색" } });
    fireEvent.click(screen.getByRole("button", { name: "목록 반복" }));
    const table = screen.getByRole("table", { name: "실행 순서와 목록 반복 하위 추출 단계" });
    fireEvent.click(within(table).getByRole("button", { name: /요소 클릭/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "대상 글자" }), { target: { value: "" } });
    fireEvent.click(within(table).getByRole("button", { name: /목록 반복 묶음/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "설정 제목" }), { target: { value: "필수값 확인" } });

    fireEvent.click(screen.getByRole("button", { name: "현재 설정 등록" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "대상 글자" })).toHaveFocus());
    expect(screen.getByRole("textbox", { name: "대상 글자" })).toHaveAttribute("aria-invalid", "true");

    fireEvent.click(within(table).getByRole("button", { name: /목록 반복 묶음/ }));
    fireEvent.click(screen.getByRole("button", { name: /테스트 실행/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "대상 글자" })).toHaveFocus());
    expect(mockedRunWebCrawler).not.toHaveBeenCalled();
  });

  it("다른 단계를 보고 있어도 잘못된 하위 추출 항목을 열고 포커스한다", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: /^단계별 실행/ }));
    fireEvent.click(screen.getByRole("button", { name: "페이지 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "목록 반복" }));
    fireEvent.click(screen.getByRole("button", { name: "데이터 추출" }));
    fireEvent.change(screen.getByRole("textbox", { name: "추출 이름" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /페이지 열기 https:/ }));

    fireEvent.click(screen.getByRole("button", { name: /테스트 실행/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "추출 이름" })).toHaveFocus());
    expect(screen.getByRole("textbox", { name: "추출 이름" })).toHaveAttribute("aria-invalid", "true");
    expect(mockedRunWebCrawler).not.toHaveBeenCalled();
  });

  it("자동 CSV와 현재 결과 CSV는 각각 다운로드 시각을 파일명에 붙인다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 27, 17, 5));
    mockedRunWebCrawler.mockResolvedValue({
      crawledAt: "2026-09-20T00:00:00Z", pageTitle: "CSV 테스트", finalUrl: "https://quotes.toscrape.com/",
      crawledPageCount: 1, scannedItemCount: 1, durationMillis: 100,
      fieldNames: ["문구"], items: [{ 문구: "예제 문구" }], warnings: [],
    });
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: /^단계별 실행/ }));
    fireEvent.click(screen.getByRole("button", { name: "페이지 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "목록 반복" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV 저장" }));
    fireEvent.click(screen.getByRole("button", { name: /테스트 실행/ }));
    await waitFor(() => expect(downloadText).toHaveBeenCalledTimes(1));
    expect(downloadText).toHaveBeenCalledWith(
      "crawler-result 2026-09-27 17-05.csv", expect.stringContaining("예제 문구"), "text/csv;charset=utf-8",
    );
    expect(vi.mocked(downloadText).mock.calls[0]?.[1]).toMatch(/^\uFEFF/);

    vi.setSystemTime(new Date(2026, 8, 27, 17, 8));
    fireEvent.click(screen.getByRole("button", { name: "현재 결과 CSV" }));
    expect(downloadText).toHaveBeenLastCalledWith(
      "crawler-result 2026-09-27 17-08.csv", expect.stringContaining("예제 문구"), "text/csv;charset=utf-8",
    );
  });

  it("필수 입력 항목에 빨간 별표 안내를 표시한다", () => {
    const { container } = renderPage();

    expect(screen.getByText("표시 항목은 필수 입력입니다.")).toBeInTheDocument();
    const startUrlInput = screen.getByLabelText("수집할 URL");
    expect(startUrlInput).toBeRequired();
    const requiredLabelText = startUrlInput.closest("label")?.querySelector("span");
    expect(requiredLabelText?.firstElementChild).toHaveClass("crawler-required-mark");
    expect(requiredLabelText).toHaveTextContent("수집할 URL");
    expect(container.querySelectorAll("input[required]").length).toBe(
      container.querySelectorAll("label .crawler-required-mark").length,
    );
  });

  it("브라우저 화면 보기는 기본 선택이며 headful 실행값을 요청에 포함한다", async () => {
    mockedRunWebCrawler.mockResolvedValue({
      crawledAt: "2026-09-20T00:00:00Z", pageTitle: "결과", finalUrl: "https://quotes.toscrape.com/",
      crawledPageCount: 1, scannedItemCount: 0, durationMillis: 100,
      fieldNames: [], items: [], warnings: [],
    });
    renderPage();

    expect(screen.getByRole("checkbox", { name: /브라우저 동작 화면 보기/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "크롤링 실행" }));

    await waitFor(() => expect(mockedRunWebCrawler).toHaveBeenCalled());
    expect(mockedRunWebCrawler.mock.calls[0]?.[0].showBrowser).toBe(true);
  });

  it("브라우저 표시 방식에서 내 PC 새 창을 선택하면 PC_WINDOW로 요청한다", async () => {
    mockedRunWebCrawler.mockResolvedValue({
      crawledAt: "2026-09-20T00:00:00Z", pageTitle: "결과", finalUrl: "https://quotes.toscrape.com/",
      crawledPageCount: 1, scannedItemCount: 0, durationMillis: 100,
      fieldNames: [], items: [], warnings: [],
    });
    renderPage();

    expect(screen.getByRole("radio", { name: /웹 화면 안에서 보기/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /내 PC에 새 창으로 열기/ }));
    fireEvent.click(screen.getByRole("button", { name: "크롤링 실행" }));

    await waitFor(() => expect(mockedRunWebCrawler).toHaveBeenCalled());
    expect(mockedRunWebCrawler.mock.calls[0]?.[0].browserWindow).toBe("PC_WINDOW");
  });

  it("검색 입력칸 선택자 옆 도움말 버튼으로 초보자 설명 팝업을 연다", () => {
    renderPage();

    fireEvent.click(screen.getByRole("checkbox", { name: /사이트 검색 후 수집/ }));
    fireEvent.click(screen.getByRole("button", { name: "검색 입력칸 선택자 도움말 열기" }));

    expect(screen.getByRole("dialog", { name: "검색 입력칸 선택자는 검색창의 주소예요" })).toBeInTheDocument();
    expect(screen.getByText(/보내주신 검색창은/)).toHaveTextContent("#topLayerQueryInput");
    expect(screen.getByLabelText("검색 입력칸 선택자")).toHaveAttribute("placeholder", expect.stringContaining("비우면 자동 탐색"));

    fireEvent.click(screen.getByRole("button", { name: "도움말 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("화면에서 입력한 키워드 그룹을 AND/OR 요청으로 보내고 결과를 표시한다", async () => {
    mockedRunWebCrawler.mockResolvedValue({
      crawledAt: "2026-09-20T00:00:00Z",
      pageTitle: "수집 예제",
      finalUrl: "https://quotes.toscrape.com/",
      crawledPageCount: 2,
      scannedItemCount: 20,
      durationMillis: 1_250,
      fieldNames: ["문구", "작성자", "상세URL"],
      items: [{ 문구: "조건에 맞는 글", 작성자: "작성자", 상세URL: "https://example.com/item", _pageUrl: "https://quotes.toscrape.com/", _pageNumber: "1" }],
      warnings: [],
    });
    renderPage();

    fireEvent.click(screen.getByRole("checkbox", { name: /키워드 조건으로 수집 결과 제한/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "키워드" }), {
      target: { value: "필수어, 2호선" },
    });
    fireEvent.change(screen.getByLabelText("키워드 그룹 1 결합 방식"), {
      target: { value: "ALL" },
    });
    fireEvent.click(screen.getByRole("button", { name: "크롤링 실행" }));

    await waitFor(() => expect(mockedRunWebCrawler).toHaveBeenCalledTimes(1));
    const submittedRequest = mockedRunWebCrawler.mock.calls.at(0)?.[0];
    expect(submittedRequest?.collectionFilter).toEqual({
      groupMatchMode: "ALL",
      groups: [{ matchMode: "ALL", keywords: ["필수어", "2호선"] }],
    });
    expect(await screen.findByRole("heading", { name: "수집 예제" })).toBeInTheDocument();
    expect(screen.getByText(/20건 검사 · 1건 수집/)).toBeInTheDocument();
    expect(screen.getByText("조건에 맞는 글")).toBeInTheDocument();
  });

  it("로그인 정보를 저장하도록 선택하면 비밀번호를 평문 입력으로 유지한다", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("checkbox", { name: /로그인 후 수집/ }));
    const usernameInput = screen.getByRole("textbox", { name: "아이디" });
    const passwordInput = screen.getByRole("textbox", { name: /비밀번호 요청대로/ });
    expect(passwordInput).toHaveAttribute("type", "text");

    fireEvent.change(usernameInput, { target: { value: "saved-user" } });
    fireEvent.change(passwordInput, { target: { value: "saved-password" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /아이디와 비밀번호 저장/ }));

    await waitFor(() => expect(window.localStorage.getItem("devnote.crawler.savedCredentials.v1"))
      .toContain("saved-password"));
    expect(passwordInput).toHaveValue("saved-password");
  });

  it("네이버 카페 프리셋이 공식 로그인과 iframe 선택자를 설정한다", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("사이트 프리셋"), { target: { value: "NAVER_CAFE" } });

    expect(screen.getByLabelText("로그인 URL")).toHaveValue("https://nid.naver.com/nidlogin.login?mode=form");
    expect(screen.getByLabelText("로그인 버튼 선택자")).toHaveValue("#log\\.login, button.btn_login");
    expect(screen.getByLabelText(/콘텐츠 iframe 선택자/)).toHaveValue("iframe#cafe_main");
    expect(screen.getByLabelText(/반복 항목 선택자/)).toHaveValue("div.article-board tbody tr");
  });

  it("실패 원인·단계·조치·추적 번호를 표시하고 저장한 비밀번호를 유지한다", async () => {
    mockedGetCrawlerLiveView.mockResolvedValue({
      active: false, stage: "네이버 추가 보안 확인", imageDataUrl: "", updatedAt: "2026-09-20T00:00:00Z",
      manualActionRequired: false, manualActionMessage: "", runStatus: "FAILURE",
      pauseRequested: false, collectedCount: 0, logs: [],
      finalReason: "네이버가 이미지 보안 질문을 표시했습니다.",
      suggestedAction: "다시 실행한 뒤 화면에서 직접 인증해 주세요.", inspecting: false, directWindow: false, steps: [], recording: false, recordedSteps: [],
    });
    mockedRunWebCrawler.mockRejectedValue({
      status: 422, errorCode: "CRAWLER_LOGIN_FAILED",
      detail: "로그인 쿠키를 확인하지 못했습니다.", crawlerStage: "로그인 완료 확인",
      suggestedAction: "로그인 화면의 추가 인증을 확인해 주세요.", elapsedMillis: 2300,
      traceId: "crawler-trace-123", fieldErrors: [],
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("사이트 프리셋"), { target: { value: "NAVER_CAFE" } });
    fireEvent.change(screen.getByLabelText("사이트 검색어"), { target: { value: "검색어" } });
    fireEvent.change(screen.getByRole("textbox", { name: "아이디" }), { target: { value: "test-user" } });
    const passwordInput = screen.getByRole("textbox", { name: /비밀번호 요청대로/ });
    fireEvent.change(passwordInput, { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /아이디와 비밀번호 저장/ }));
    fireEvent.click(screen.getByRole("button", { name: "크롤링 실행" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("로그인 쿠키를 확인하지 못했습니다.");
    expect(alert).toHaveTextContent("실패 단계");
    expect(alert).toHaveTextContent("로그인 완료 확인");
    expect(alert).toHaveTextContent("추가 인증");
    expect(alert).toHaveTextContent("이 단계에서 실제로 사용한 입력값");
    expect(alert).toHaveTextContent("https://nid.naver.com/nidlogin.login?mode=form");
    expect(alert).toHaveTextContent("test-user");
    expect(alert).toHaveTextContent("비밀번호 입력값");
    expect(alert).toHaveTextContent("test-password");
    expect(passwordInput).toHaveValue("test-password");
    expect(await screen.findByText("마지막 Chromium 화면")).toBeInTheDocument();
    expect(screen.getByText(/실행 종료 이유/)).toHaveTextContent("네이버 추가 보안 확인");
    expect(screen.getByText("네이버가 이미지 보안 질문을 표시했습니다.")).toBeInTheDocument();
    expect(screen.getByText("내가 해야 할 일")).toBeInTheDocument();
    expect(screen.getByText(/원인을 확인할 수 있도록 마지막 화면을 유지/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("기술 정보 보기"));
    expect(alert).toHaveTextContent("HTTP 422");
    expect(alert).toHaveTextContent("crawler-trace-123");
  });

  it("저장된 네이버 세션이 있으면 계정정보 없이 자동 로그인 모드로 요청한다", async () => {
    mockedGetNaverSessionStatus.mockResolvedValue({ available: true, updatedAt: "2026-09-20T00:00:00Z" });
    mockedRunWebCrawler.mockResolvedValue({
      crawledAt: "2026-09-20T00:00:00Z", pageTitle: "네이버 카페", finalUrl: "https://cafe.naver.com/lhuniv9",
      crawledPageCount: 1, scannedItemCount: 1, durationMillis: 100,
      fieldNames: ["제목"], items: [{ 제목: "LH 매물", _pageUrl: "https://cafe.naver.com/lhuniv9", _pageNumber: "1" }], warnings: [],
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("사이트 프리셋"), { target: { value: "NAVER_CAFE" } });
    expect(await screen.findByText("저장된 네이버 로그인 세션 있음")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("사이트 검색어"), { target: { value: "LH" } });
    fireEvent.click(screen.getByRole("button", { name: "크롤링 실행" }));

    await waitFor(() => expect(mockedRunWebCrawler).toHaveBeenCalledTimes(1));
    const request = mockedRunWebCrawler.mock.calls.at(0)?.[0];
    expect(request?.login).toEqual({
      mode: "SAVED_SESSION", loginUrl: "", username: "", password: "",
      usernameSelector: "", passwordSelector: "", submitSelector: "", loggedInSelector: "",
    });
  });

  it("단계 모드에서 기존 방식의 설정을 불러오면 로그인과 검색 폼을 복원한다", async () => {
    window.localStorage.setItem("devnote.crawler.runMode.v1", "STEPS");
    mockedGetCrawlerConfigurations.mockResolvedValue([savedNaverConfiguration]);
    renderPage(false);

    expect(await screen.findByText("LH 매물 수집")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "열기·수정" }));

    expect(screen.getByLabelText("수집할 URL")).toHaveValue("https://cafe.naver.com/lhuniv9");
    expect(screen.getByRole("radio", { name: /기존 설정 방식/ })).toBeChecked();
    expect(window.localStorage.getItem("devnote.crawler.runMode.v1")).toBe("LEGACY");
    expect(screen.getByLabelText("로그인 버튼 선택자")).toHaveValue("#loginBtn_column:visible, #loginBtn_row:visible");
    expect(screen.getByLabelText(/반복 항목 선택자/)).toHaveValue("div.article-board tbody tr");
    expect(screen.getByRole("button", { name: "#7 설정 실행 · 이력 저장" })).toBeInTheDocument();
  });

  it("실행 이력 결과를 다시 열면 결과 검색 조건을 초기화한다", async () => {
    const historySummary = {
      historyId: 11, configurationId: 7, status: "SUCCESS", failureStage: null, failureMessage: null,
      durationMillis: 100, itemCount: 1, startedAt: "2026-09-20T00:00:00Z", completedAt: "2026-09-20T00:00:01Z",
    };
    mockedGetCrawlerConfigurations.mockResolvedValue([savedNaverConfiguration]);
    mockedGetCrawlerRunHistories.mockResolvedValue([historySummary]);
    mockedGetCrawlerRunHistory.mockResolvedValue({
      ...historySummary,
      request: savedNaverConfiguration.request,
      result: {
        crawledAt: "2026-09-20T00:00:00Z", pageTitle: "이력 결과", finalUrl: "https://cafe.naver.com/lhuniv9",
        crawledPageCount: 1, scannedItemCount: 1, durationMillis: 100,
        fieldNames: ["제목"], items: [{ 제목: "봉천 원룸", _pageUrl: "https://cafe.naver.com/lhuniv9", _pageNumber: "1" }], warnings: [],
      },
    });
    renderPage(false);

    fireEvent.click(await screen.findByRole("button", { name: "열기·수정" }));
    fireEvent.click(screen.getByRole("button", { name: "목록으로" }));
    fireEvent.click(await screen.findByRole("button", { name: "결과 보기" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "수집 결과 빠른 검색" }), { target: { value: "없는 값" } });
    expect(screen.getByText("검색 조건에 맞는 데이터가 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "수집 결과 빠른 검색" })).toHaveValue(""));
    expect(screen.getByText("봉천 원룸")).toBeInTheDocument();
  });
});
