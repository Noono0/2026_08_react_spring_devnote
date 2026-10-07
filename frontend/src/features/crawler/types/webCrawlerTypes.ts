import { z } from "zod";

/*
 * webCrawlerTypes.ts — 크롤러 요청·응답 타입과 응답 검증 스키마
 *
 * ★ 서버 crawler/dto의 Java record와 필드 이름·값이 같아야 한다(예: CrawlerRunRequest, CrawlerLiveViewResponse).
 * 보내는 값(요청)은 interface로, 받는 값(응답)은 Zod 스키마로 만들고 z.infer로 타입을 뽑는다.
 * → 응답은 실제로 검사(parse)되므로, 서버 모양이 바뀌면 화면 깊은 곳이 아니라 API 호출 지점에서 바로 오류가 난다.
 */

// 로그인 방식 / 값 읽는 방식(글자·속성) / 키워드 결합(모두·하나라도)
export type CrawlerLoginMode = "NONE" | "FORM" | "SAVED_SESSION";
export type CrawlerValueSource = "TEXT" | "ATTRIBUTE";
export type CrawlerMatchMode = "ALL" | "ANY";

/** 로그인 설정(서버 CrawlerLoginRequest). 아이디·비밀번호는 서버 DB에 저장되지 않는다. */
export interface CrawlerLoginRequest {
  mode: CrawlerLoginMode;
  loginUrl: string;
  username: string;
  password: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  loggedInSelector: string;
}

/** 수집할 값 하나 = 결과 표의 열 하나(이름, 항목 안 선택자, 글자/속성). */
export interface CrawlerFieldRequest {
  name: string;
  selector: string;
  valueSource: CrawlerValueSource;
  attributeName: string;
}

/** 사이트 안 검색창 사용 설정 */
export interface CrawlerPageSearchRequest {
  enabled: boolean;
  keyword: string;
  inputSelector: string;
  submitSelector: string;
}

/** 수집 단계의 키워드 필터(서버 CrawlerItemMatcher가 판단). 그룹 안 결합 + 그룹끼리 결합 두 단계다. */
export interface CrawlerKeywordGroupRequest {
  matchMode: CrawlerMatchMode;
  keywords: string[];
}

export interface CrawlerCollectionFilterRequest {
  groupMatchMode: CrawlerMatchMode;
  groups: CrawlerKeywordGroupRequest[];
}

/** 단계 종류: 이동·클릭·입력·키·대기·나타날 때까지 대기·직접 처리·목록 수집 */
export type CrawlerStepType = "GOTO" | "CLICK" | "FILL" | "PRESS" | "WAIT" | "WAIT_FOR" | "MANUAL" | "COLLECT" | "SCROLL" | "NEXT_PAGE" | "CSV";
/** 대상 찾는 방법: 화면 글자(기본) · CSS 선택자 · 화면 좌표 */
export type CrawlerTargetMode = "TEXT" | "SELECTOR" | "COORDINATE";

/** 단계별 실행의 한 단계. x·y·timeoutMillis는 필요할 때만 값이 있다. */
export interface CrawlerScenarioStep {
  type: CrawlerStepType;
  targetMode: CrawlerTargetMode;
  target: string;
  x: number | null;
  y: number | null;
  value: string;
  memo: string;
  timeoutMillis: number | null;
  /** 목록 반복 안에서 각 항목에 적용하는 추출 단계. 없으면 공통 수집 설정 사용. */
  fields?: CrawlerFieldRequest[];
}

// 녹화된 단계·저장된 설정을 받을 때 검사하는 스키마(위 interface와 같은 모양).
export const crawlerScenarioStepSchema = z.object({
  type: z.enum(["GOTO", "CLICK", "FILL", "PRESS", "WAIT", "WAIT_FOR", "MANUAL", "COLLECT", "SCROLL", "NEXT_PAGE", "CSV"]),
  targetMode: z.enum(["TEXT", "SELECTOR", "COORDINATE"]).default("TEXT"),
  target: z.string().default(""),
  x: z.number().nullable().default(null),
  y: z.number().nullable().default(null),
  value: z.string().default(""),
  memo: z.string().default(""),
  timeoutMillis: z.number().int().nullable().default(null),
  fields: z.array(z.object({ name: z.string(), selector: z.string(), valueSource: z.enum(["TEXT", "ATTRIBUTE"]), attributeName: z.string() })).max(12).nullish().transform((fields) => fields ?? undefined),
});

/** WEB: 웹 화면 안에서 보기, PC_WINDOW: 내 PC에 새 브라우저 창으로 열기 */
export type CrawlerBrowserWindow = "WEB" | "PC_WINDOW";

/** 실행 요청 전체(서버 CrawlerRunRequest). steps가 비어 있으면 기존 폼 방식, 있으면 단계 방식으로 실행된다. */
export interface CrawlerRunRequest {
  showBrowser: boolean;
  browserWindow: CrawlerBrowserWindow;
  /** 단계별 실행 목록. 비어 있으면 [LEGACY-FORM] 기존 설정 방식으로 실행한다. */
  steps: CrawlerScenarioStep[];
  /** 목록 수집 뒤 각 항목 링크를 열어 본문을 '상세내용'으로 가져올지 여부 */
  collectDetail: boolean;
  /** 상세글 본문 선택자(비우면 자동 탐색) */
  detailSelector: string;
  /** 제목에서 보증금·월세·방 수·면적·역·도보·층을 뽑아 칸으로 나눌지 여부 */
  parseListing: boolean;
  startUrl: string;
  login: CrawlerLoginRequest;
  pageSearch: CrawlerPageSearchRequest;
  contentFrameSelector: string;
  itemSelector: string;
  fields: CrawlerFieldRequest[];
  collectionFilter: CrawlerCollectionFilterRequest;
  nextPageSelector: string;
  maxPages: number;
  waitAfterNavigationMillis: number;
  maxItems: number;
}

export type CrawlerSitePreset = "GENERIC" | "NAVER_CAFE";

const crawlerLoginRequestSchema = z.object({
  mode: z.enum(["NONE", "FORM", "SAVED_SESSION"]),
  loginUrl: z.string(), username: z.string(), password: z.string(),
  usernameSelector: z.string(), passwordSelector: z.string(), submitSelector: z.string(), loggedInSelector: z.string(),
});

const crawlerFieldRequestSchema = z.object({
  name: z.string(), selector: z.string(), valueSource: z.enum(["TEXT", "ATTRIBUTE"]), attributeName: z.string(),
});

// 저장된 설정·이력의 request를 받을 때 검사한다. z.ZodType<CrawlerRunRequest>로 위 interface와 모양이 맞는지 컴파일러가 확인한다.
export const crawlerRunRequestSchema: z.ZodType<CrawlerRunRequest> = z.object({
  showBrowser: z.boolean().default(true),
  browserWindow: z.enum(["WEB", "PC_WINDOW"]).default("WEB"),
  steps: z.array(crawlerScenarioStepSchema).default([]),
  collectDetail: z.boolean().default(false),
  detailSelector: z.string().default(""),
  parseListing: z.boolean().default(false),
  startUrl: z.string(),
  login: crawlerLoginRequestSchema,
  pageSearch: z.object({ enabled: z.boolean(), keyword: z.string(), inputSelector: z.string(), submitSelector: z.string() }),
  contentFrameSelector: z.string(), itemSelector: z.string(),
  fields: z.array(crawlerFieldRequestSchema),
  collectionFilter: z.object({
    groupMatchMode: z.enum(["ALL", "ANY"]),
    groups: z.array(z.object({ matchMode: z.enum(["ALL", "ANY"]), keywords: z.array(z.string()) })),
  }),
  nextPageSelector: z.string(), maxPages: z.number().int(), waitAfterNavigationMillis: z.number().int(), maxItems: z.number().int(),
});

// 실행 결과(서버 CrawlerRunResponse). items는 { 열 이름: 값 } 객체의 배열이다.
export const crawlerRunResponseSchema = z.object({
  crawledAt: z.string().datetime(),
  pageTitle: z.string(),
  finalUrl: z.string(),
  crawledPageCount: z.number().int().nonnegative(),
  scannedItemCount: z.number().int().nonnegative(),
  durationMillis: z.number().int().nonnegative(),
  fieldNames: z.array(z.string()),
  items: z.array(z.record(z.string(), z.string())),
  warnings: z.array(z.string()),
});

export type CrawlerRunResponse = z.infer<typeof crawlerRunResponseSchema>;

// 실시간 화면 상태(서버 CrawlerLiveViewResponse). 0.7초마다 받아 화면 캡처·단계 진행·로그를 그린다.
export const crawlerLiveViewSchema = z.object({
  active: z.boolean(),
  stage: z.string(),
  imageDataUrl: z.string(),
  updatedAt: z.string().datetime(),
  manualActionRequired: z.boolean(),
  manualActionMessage: z.string(),
  runStatus: z.enum(["IDLE", "RUNNING", "WAITING_FOR_USER", "SUCCESS", "FAILURE", "RECORDING", "RECORDED"]),
  finalReason: z.string(),
  suggestedAction: z.string(),
  inspecting: z.boolean(),
  directWindow: z.boolean(),
  steps: z.array(z.object({
    index: z.number().int(),
    label: z.string(),
    status: z.enum(["PENDING", "RUNNING", "DONE", "BLOCKED", "WAITING", "SKIPPED", "FAILED"]),
    detail: z.string(),
  })).default([]),
  recording: z.boolean().default(false),
  recordedSteps: z.array(crawlerScenarioStepSchema).default([]),
  pauseRequested: z.boolean().default(false),
  collectedCount: z.number().int().nonnegative().default(0),
  logs: z.array(z.object({ time: z.string(), step: z.string(), status: z.string(), message: z.string() })).default([]),
});

export type CrawlerLiveView = z.infer<typeof crawlerLiveViewSchema>;

/** 실시간 화면에서 보내는 수동 조작(클릭 좌표·글자·키·계속/다시 시도/건너뛰기/중단/일시정지). */
export interface CrawlerManualActionRequest {
  action: "CLICK" | "TYPE" | "KEY" | "CONTINUE" | "RETRY" | "SKIP" | "STOP" | "PAUSE";
  x?: number;
  y?: number;
  text?: string;
}

export interface CrawlerConfigurationSaveRequest {
  title: string;
  description: string;
  sitePreset: CrawlerSitePreset;
  request: CrawlerRunRequest;
}

// 저장된 설정과 실행 이력(목록·상세), 이력 번호가 붙은 실행 결과, 네이버 세션 상태 응답.
export const crawlerConfigurationSchema = z.object({
  configurationId: z.number().int().positive(), title: z.string(), description: z.string(),
  sitePreset: z.enum(["GENERIC", "NAVER_CAFE"]), request: crawlerRunRequestSchema,
  runCount: z.number().int().nonnegative(), lastRunStatus: z.string().nullable(), lastRunAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export type CrawlerConfiguration = z.infer<typeof crawlerConfigurationSchema>;

export const crawlerRunHistorySummarySchema = z.object({
  historyId: z.number().int().positive(), configurationId: z.number().int().positive(), status: z.string(),
  failureStage: z.string().nullable(), failureMessage: z.string().nullable(),
  durationMillis: z.number().int().nonnegative(), itemCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
});

export type CrawlerRunHistorySummary = z.infer<typeof crawlerRunHistorySummarySchema>;

export const crawlerRunHistoryDetailSchema = crawlerRunHistorySummarySchema.extend({
  request: crawlerRunRequestSchema,
  result: crawlerRunResponseSchema.nullable(),
});

export type CrawlerRunHistoryDetail = z.infer<typeof crawlerRunHistoryDetailSchema>;

export const crawlerTrackedRunResponseSchema = z.object({
  historyId: z.number().int().positive(),
  result: crawlerRunResponseSchema,
});

export type CrawlerTrackedRunResponse = z.infer<typeof crawlerTrackedRunResponseSchema>;

export const crawlerSessionStatusSchema = z.object({
  available: z.boolean(),
  updatedAt: z.string().datetime().nullable(),
});

export type CrawlerSessionStatus = z.infer<typeof crawlerSessionStatusSchema>;

// 결과 표 거르기 규칙(화면 전용 — 서버로 보내지 않는다).
export type CrawlerFilterOperator = "CONTAINS" | "NOT_CONTAINS" | "EQUALS" | "NUMBER_GTE" | "NUMBER_LTE";

export interface CrawlerFilterRule {
  id: string;
  fieldName: string;
  operator: CrawlerFilterOperator;
  value: string;
}
