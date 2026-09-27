import type { ApiProblemDetails } from "@/shared/api/error/apiErrorTypes";
import type {
  CrawlerLiveView,
  CrawlerRunRequest,
  CrawlerSitePreset,
} from "@/features/crawler/types/webCrawlerTypes";

/**
 * 크롤링 실패 정보를 그대로 복사·붙여넣기 할 수 있는 텍스트 리포트로 만든다.
 *
 * "어느 단계에서, 왜, 어떤 값으로" 실패했는지 입력값을 가공하지 않고 그대로 보여준다.
 * 아이디·비밀번호도 입력한 그대로 포함하므로, 공유할지는 사용자가 직접 판단한다.
 */
export interface CrawlerFailureReportInput {
  problem: ApiProblemDetails;
  request?: CrawlerRunRequest;
  sitePreset?: CrawlerSitePreset;
  liveView?: CrawlerLiveView;
  occurredAt?: Date;
  pageUrl?: string;
}

const NONE = "(없음)";

const text = (value: string | undefined | null): string => value?.trim() || NONE;

/** 앞뒤 공백까지 확인할 수 있도록 입력값을 따옴표로 감싸 그대로 보여준다. */
const raw = (value: string): string => (value.length > 0 ? `"${value}"` : NONE);

const loginModeLabel = (mode: CrawlerRunRequest["login"]["mode"]): string => {
  if (mode === "SAVED_SESSION") return "저장된 로그인 세션";
  if (mode === "FORM") return "아이디·비밀번호 폼 로그인";
  return "로그인하지 않음";
};

const formatTime = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} (${timeZone})`;
};

const describeStatus = (status: number): string => {
  if (status === 0) return "0 (서버에 연결하지 못함)";
  return String(status);
};

const resultLines = (problem: ApiProblemDetails): string[] => [
  "[결과]",
  `- HTTP 상태: ${describeStatus(problem.status)}`,
  `- 오류 코드: ${text(problem.errorCode)}`,
  `- 실패 단계: ${text(problem.crawlerStage) === NONE ? "(서버가 단계를 알려주지 않음 → 크롤링 시작 전 또는 서버 연결 단계에서 실패)" : problem.crawlerStage}`,
  `- 실패 이유: ${text(problem.detail)}`,
  `- 다음 조치: ${text(problem.suggestedAction)}`,
  `- 걸린 시간: ${typeof problem.elapsedMillis === "number" ? `${(problem.elapsedMillis / 1000).toFixed(1)}초` : NONE}`,
  `- 추적 번호: ${text(problem.traceId)}`,
  ...(problem.technicalMessage?.trim()
    ? ["- 원본 오류 메시지:", ...problem.technicalMessage.trim().split("\n").map((line) => `    ${line}`)]
    : ["- 원본 오류 메시지: (없음)"]),
  ...(problem.fieldErrors?.length
    ? ["- 입력값 오류:", ...problem.fieldErrors.map((error) => `  - ${error.fieldName}: ${error.message}`)]
    : []),
];

const liveViewLines = (liveView: CrawlerLiveView | undefined): string[] => {
  if (!liveView) return ["[브라우저 화면 상태]", "- (화면 정보를 불러오지 못함)"];
  return [
    "[브라우저 화면 상태]",
    `- 마지막 단계: ${text(liveView.stage)}`,
    `- 실행 상태: ${liveView.runStatus}${liveView.inspecting ? " · 브라우저 열려 있음" : ""}${liveView.manualActionRequired ? " · 사용자 조작 대기" : ""}`,
    `- 조작 방식: ${liveView.directWindow ? "PC 브라우저 창에서 직접 조작" : "웹 화면에서 원격 조작"}`,
    `- 화면 캡처: ${liveView.imageDataUrl ? "있음" : "없음 (브라우저가 시작되기 전에 실패했을 수 있음)"}`,
    `- 화면에 기록된 종료 이유: ${text(liveView.finalReason)}`,
  ];
};

const requestLines = (request: CrawlerRunRequest | undefined, sitePreset: CrawlerSitePreset | undefined): string[] => {
  if (!request) return ["[입력한 값]", "- (입력값 정보 없음)"];
  const { login, pageSearch, collectionFilter } = request;
  const lines = [
    "[입력한 값]",
    `- 사이트 프리셋: ${sitePreset === "NAVER_CAFE" ? "네이버 카페" : "일반 사이트 · 직접 설정"}`,
    `- 수집 URL: ${text(request.startUrl)}`,
    `- 브라우저: 화면 보기 ${request.showBrowser ? "켜짐" : "꺼짐"} · 표시 방식 ${request.browserWindow === "PC_WINDOW" ? "내 PC 새 창(PC_WINDOW)" : "웹 화면(WEB)"}`,
    `- 로그인 방식: ${loginModeLabel(login.mode)}`,
  ];
  if (login.mode === "FORM") {
    lines.push(
      `- 로그인 URL: ${text(login.loginUrl)}`,
      `- 아이디: ${raw(login.username)}`,
      `- 비밀번호: ${raw(login.password)}`,
      `- 아이디 입력칸 선택자: ${text(login.usernameSelector)}`,
      `- 비밀번호 입력칸 선택자: ${text(login.passwordSelector)}`,
      `- 로그인 버튼 선택자: ${text(login.submitSelector)}`,
      `- 로그인 완료 선택자: ${text(login.loggedInSelector)}`,
    );
  }
  lines.push(pageSearch.enabled
    ? `- 사이트 검색: 사용 · 검색어 "${pageSearch.keyword}" · 입력칸 ${text(pageSearch.inputSelector)} · 실행 ${pageSearch.submitSelector.trim() ? `버튼 ${pageSearch.submitSelector.trim()}` : "Enter 키"}`
    : "- 사이트 검색: 사용 안 함");
  lines.push(
    `- 콘텐츠 iframe 선택자: ${text(request.contentFrameSelector)}`,
    `- 반복 항목 선택자: ${text(request.itemSelector)}`,
    `- 수집 필드: ${request.fields.length === 0 ? NONE : request.fields
      .map((field) => `${text(field.name)}=${text(field.selector)}(${field.valueSource === "ATTRIBUTE" ? `속성 ${text(field.attributeName)}` : "텍스트"})`)
      .join(", ")}`,
    `- 키워드 조건: ${collectionFilter.groups.length === 0 ? "사용 안 함" : `그룹 사이 ${collectionFilter.groupMatchMode} · ${collectionFilter.groups
      .map((group) => `[${group.matchMode}: ${group.keywords.join(", ")}]`)
      .join(" ")}`}`,
    `- 다음 페이지 버튼 선택자: ${text(request.nextPageSelector)}`,
    `- 최대 페이지 / 항목 / 페이지 대기: ${request.maxPages}페이지 / ${request.maxItems}건 / ${request.waitAfterNavigationMillis}ms`,
  );
  return lines;
};

export const buildCrawlerFailureReport = ({
  problem, request, sitePreset, liveView, occurredAt = new Date(), pageUrl,
}: CrawlerFailureReportInput): string => [
  "=== 크롤링 실패 상세 ===",
  `- 발생 시각: ${formatTime(occurredAt)}`,
  `- 화면 주소: ${text(pageUrl)}`,
  "",
  ...resultLines(problem),
  "",
  ...liveViewLines(liveView),
  "",
  ...requestLines(request, sitePreset),
  "=== 끝 ===",
].join("\n");
