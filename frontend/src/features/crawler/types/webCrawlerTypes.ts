import { z } from "zod";

export type CrawlerLoginMode = "NONE" | "FORM" | "SAVED_SESSION";
export type CrawlerValueSource = "TEXT" | "ATTRIBUTE";
export type CrawlerMatchMode = "ALL" | "ANY";

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

export interface CrawlerFieldRequest {
  name: string;
  selector: string;
  valueSource: CrawlerValueSource;
  attributeName: string;
}

export interface CrawlerPageSearchRequest {
  enabled: boolean;
  keyword: string;
  inputSelector: string;
  submitSelector: string;
}

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

export type CrawlerFilterOperator = "CONTAINS" | "NOT_CONTAINS" | "EQUALS" | "NUMBER_GTE" | "NUMBER_LTE";

export interface CrawlerFilterRule {
  id: string;
  fieldName: string;
  operator: CrawlerFilterOperator;
  value: string;
}
