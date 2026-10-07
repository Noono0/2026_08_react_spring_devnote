import { z } from "zod";
import { parseStoredArray } from "@/shared/lib/parseStoredArray";

// apiWorkspaceStorage.ts — API 작업 공간이 localStorage에 저장한 탭·기록·컬렉션·폴더·저장 요청·환경을 Zod로 검사하며 읽는다.
// parseStoredArray: 깨진 JSON이면 빈 배열, 모양이 틀린 항목만 골라 버리고 나머지는 살린다.
const keyValueSchema = z.object({
  id: z.string(), key: z.string(), value: z.string(), enabled: z.boolean(), secret: z.boolean().optional(),
});
const requestSchema = z.object({
  id: z.string(), name: z.string(), url: z.string(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  params: keyValueSchema.array(), headers: keyValueSchema.array(),
  authorization: z.object({
    type: z.enum(["NONE", "BEARER", "BASIC", "API_KEY"]),
    bearerToken: z.string(), username: z.string(), password: z.string(),
    apiKeyName: z.string(), apiKeyValue: z.string(), apiKeyLocation: z.enum(["HEADER", "QUERY"]),
  }),
  bodyType: z.enum(["NONE", "JSON", "TEXT", "FORM_URLENCODED", "FORM_DATA"]),
  bodyText: z.string(),
  formData: keyValueSchema.extend({ valueType: z.enum(["TEXT", "FILE"]) }).array(),
  timeoutMilliseconds: z.number().nonnegative(), privateExecution: z.boolean(), saveResponseBody: z.boolean(),
});
const tabSchema = z.object({
  id: z.string(), request: requestSchema, dirty: z.boolean(),
  savedRequestId: z.string().optional(), historyItemId: z.string().optional(),
  saveTargetCollectionId: z.string().optional(), saveTargetFolderId: z.string().optional(),
});
const historySchema = z.object({
  id: z.string(), request: requestSchema, responseStatus: z.number().optional(),
  responseTimeMilliseconds: z.number().nonnegative(), responseSizeBytes: z.number().nonnegative(),
  responseBody: z.string().optional(), successful: z.boolean(), executedAt: z.string(),
});
const collectionSchema = z.object({ id: z.string(), name: z.string(), description: z.string(), createdAt: z.string() });
const folderSchema = z.object({ id: z.string(), collectionId: z.string(), name: z.string() });
const savedRequestSchema = z.object({
  id: z.string(), collectionId: z.string(), folderId: z.string().optional(), name: z.string(),
  description: z.string(), favorite: z.boolean(), request: requestSchema,
  createdAt: z.string(), updatedAt: z.string(), deletedAt: z.string().optional(),
});
const environmentSchema = z.object({
  id: z.string(), name: z.string(), variables: keyValueSchema.extend({ secret: z.boolean() }).array(),
});

export const API_WORKSPACE_MAX_HISTORY_ITEMS = 100;
// 열린 탭은 최대 8개, 요청 기록은 최대 100개까지만 복원한다(저장소가 무한히 커지지 않게).
export const parseStoredTabs = (value: string | null) => parseStoredArray(value, tabSchema).slice(0, 8);
export const parseStoredHistory = (value: string | null) => parseStoredArray(value, historySchema).slice(0, API_WORKSPACE_MAX_HISTORY_ITEMS);
export const parseStoredCollections = (value: string | null) => parseStoredArray(value, collectionSchema);
export const parseStoredFolders = (value: string | null) => parseStoredArray(value, folderSchema);
export const parseStoredSavedRequests = (value: string | null) => parseStoredArray(value, savedRequestSchema);
export const parseStoredEnvironments = (value: string | null) => parseStoredArray(value, environmentSchema);
