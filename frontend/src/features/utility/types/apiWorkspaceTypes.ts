export type ApiWorkspaceMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type ApiWorkspacePanel = "HISTORY" | "COLLECTIONS" | "ENVIRONMENTS" | "FAVORITES";
export type RequestEditorSection = "PARAMS" | "AUTHORIZATION" | "HEADERS" | "BODY";
export type ResponseViewerSection = "BODY" | "HEADERS" | "ACTUAL_REQUEST" | "STATUS";
export type ResponseBodyView = "PRETTY" | "RAW" | "PREVIEW";
export type RequestBodyType = "NONE" | "JSON" | "TEXT" | "FORM_URLENCODED" | "FORM_DATA";
export type RequestAuthorizationType = "NONE" | "BEARER" | "BASIC" | "API_KEY";

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

export interface ApiWorkspaceAuthorization {
  type: RequestAuthorizationType;
  bearerToken: string;
  username: string;
  password: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyLocation: "HEADER" | "QUERY";
}

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

export interface ApiWorkspaceTab {
  id: string;
  request: ApiWorkspaceRequest;
  savedRequestId?: string;
  historyItemId?: string;
  saveTargetCollectionId?: string;
  saveTargetFolderId?: string;
  dirty: boolean;
}

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
