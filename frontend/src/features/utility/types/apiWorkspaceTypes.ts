// apiWorkspaceTypes.ts — API 작업 공간(브라우저에서 HTTP 요청을 만들고 보내 보는 Postman 비슷한 도구)의 타입
// 서버로 보내지 않고 브라우저 localStorage에 저장하는 화면 전용 데이터라, 저장할 때 비밀 값은 가리고 읽을 때 Zod로 검사한다.
//
// 화면 구역 이름: 왼쪽 패널(기록·컬렉션·환경·즐겨찾기) / 요청 편집 탭(파라미터·인증·헤더·본문) / 응답 탭(본문·헤더·실제 요청·상태)
export type ApiWorkspaceMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type ApiWorkspacePanel = "HISTORY" | "COLLECTIONS" | "ENVIRONMENTS" | "FAVORITES";
export type RequestEditorSection = "PARAMS" | "AUTHORIZATION" | "HEADERS" | "BODY";
export type ResponseViewerSection = "BODY" | "HEADERS" | "ACTUAL_REQUEST" | "STATUS";
export type ResponseBodyView = "PRETTY" | "RAW" | "PREVIEW";
export type RequestBodyType = "NONE" | "JSON" | "TEXT" | "FORM_URLENCODED" | "FORM_DATA";
export type RequestAuthorizationType = "NONE" | "BEARER" | "BASIC" | "API_KEY";

/** 파라미터·헤더 한 줄. enabled를 끄면 지우지 않고 잠시 빼 둔다. secret이면 화면·저장에서 값을 가린다. */
export interface ApiWorkspaceKeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
}

export interface ApiWorkspaceFormDataEntry extends ApiWorkspaceKeyValue {
  valueType: "TEXT" | "FILE";
  file?: File;
}

/** 인증 설정. 종류에 따라 쓰는 칸이 다르다(Bearer 토큰 / Basic 아이디·비밀번호 / API 키 이름·값·위치). 저장할 때 값은 지운다. */
export interface ApiWorkspaceAuthorization {
  type: RequestAuthorizationType;
  bearerToken: string;
  username: string;
  password: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyLocation: "HEADER" | "QUERY";
}

/**
 * 요청 하나. url·값에는 {{baseUrl}} 같은 환경 변수를 쓸 수 있고, 보낼 때 실제 값으로 바꾼다.
 * privateExecution: 켜면 실행 기록에 남기지 않는다. saveResponseBody: 켜면 기록에 응답 본문도 저장한다(민감할 수 있어 기본 꺼짐).
 */
export interface ApiWorkspaceRequest {
  id: string;
  name: string;
  method: ApiWorkspaceMethod;
  url: string;
  params: ApiWorkspaceKeyValue[];
  headers: ApiWorkspaceKeyValue[];
  authorization: ApiWorkspaceAuthorization;
  bodyType: RequestBodyType;
  bodyText: string;
  formData: ApiWorkspaceFormDataEntry[];
  timeoutMilliseconds: number;
  privateExecution: boolean;
  saveResponseBody: boolean;
}

/** 열린 탭. 저장된 요청·기록에서 열었으면 그 id를 기억하고, 고친 뒤 저장하지 않았으면 dirty = true. */
export interface ApiWorkspaceTab {
  id: string;
  request: ApiWorkspaceRequest;
  savedRequestId?: string;
  historyItemId?: string;
  saveTargetCollectionId?: string;
  saveTargetFolderId?: string;
  dirty: boolean;
}

/** 받은 응답. 본문은 화면 표시용으로 최대 1MB까지만 담고, 넘으면 truncated. downloadBlob은 원본 내려받기용. */
export interface ApiWorkspaceResponse {
  status: number;
  statusText: string;
  elapsedMilliseconds: number;
  sizeBytes: number;
  headers: ApiWorkspaceKeyValue[];
  body: string;
  contentType: string;
  truncated: boolean;
  receivedAt: string;
  downloadBlob?: Blob;
}

/** 환경 변수·인증을 모두 적용한 뒤 "실제로 보낸" 요청(응답 탭의 실제 요청 화면에 보여 준다). */
export interface ApiWorkspaceActualRequest {
  method: ApiWorkspaceMethod;
  url: string;
  headers: ApiWorkspaceKeyValue[];
  body: string;
  bodyType: RequestBodyType;
  preparedAt: string;
}

export interface ApiWorkspaceHistoryItem {
  id: string;
  request: ApiWorkspaceRequest;
  responseStatus?: number;
  responseTimeMilliseconds: number;
  responseSizeBytes: number;
  responseBody?: string;
  successful: boolean;
  executedAt: string;
}

// 컬렉션 → 폴더 → 저장된 요청의 트리 구조. 저장된 요청의 deletedAt이 있으면 휴지통에 있는 것이다.
export interface ApiWorkspaceCollection {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface ApiWorkspaceFolder {
  id: string;
  collectionId: string;
  name: string;
}

export interface ApiWorkspaceSavedRequest {
  id: string;
  collectionId: string;
  folderId?: string;
  name: string;
  description: string;
  favorite: boolean;
  request: ApiWorkspaceRequest;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// 환경(로컬·운영 등)마다 변수 목록을 둔다. secret 변수는 화면과 내보내기에서 값을 가린다.
export interface ApiWorkspaceEnvironmentVariable {
  id: string;
  key: string;
  value: string;
  secret: boolean;
  enabled: boolean;
}

export interface ApiWorkspaceEnvironment {
  id: string;
  name: string;
  variables: ApiWorkspaceEnvironmentVariable[];
}

// 컬렉션 실행기: 컬렉션의 요청을 차례로 보내고 결과를 기록한다. 수동 실행 또는 매일 정해진 시각 예약(SCHEDULED, 화면이 열려 있을 때만).
export type ApiCollectionRunTrigger = "MANUAL" | "SCHEDULED";
export type ApiCollectionRunStatus = "RUNNING" | "COMPLETED" | "CANCELLED";

export interface ApiCollectionRunRequestResult {
  id: string;
  savedRequestId: string;
  requestName: string;
  method: ApiWorkspaceMethod;
  iteration: number;
  responseStatus?: number;
  responseTimeMilliseconds: number;
  successful: boolean;
  errorMessage?: string;
}

export interface ApiCollectionRun {
  id: string;
  collectionId: string;
  collectionName: string;
  environmentName?: string;
  scheduleId?: string;
  trigger: ApiCollectionRunTrigger;
  status: ApiCollectionRunStatus;
  startedAt: string;
  finishedAt?: string;
  totalRequestCount: number;
  completedRequestCount: number;
  results: ApiCollectionRunRequestResult[];
}

export interface ApiCollectionSchedule {
  id: string;
  name: string;
  collectionId: string;
  environmentId?: string;
  selectedRequestIds: string[];
  localTime: string;
  iterationCount: number;
  delayMilliseconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastRunAt?: string;
  lastRunStatus?: Exclude<ApiCollectionRunStatus, "RUNNING">;
  lastRunSuccessful?: boolean;
}
