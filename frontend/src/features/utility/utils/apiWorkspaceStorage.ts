import { z } from "zod";
import { parseStoredArray } from "@/shared/lib/parseStoredArray";

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
export const parseStoredTabs = (value: string | null) => parseStoredArray(value, tabSchema).slice(0, 8);
export const parseStoredHistory = (value: string | null) => parseStoredArray(value, historySchema).slice(0, API_WORKSPACE_MAX_HISTORY_ITEMS);
export const parseStoredCollections = (value: string | null) => parseStoredArray(value, collectionSchema);
export const parseStoredFolders = (value: string | null) => parseStoredArray(value, folderSchema);
export const parseStoredSavedRequests = (value: string | null) => parseStoredArray(value, savedRequestSchema);
export const parseStoredEnvironments = (value: string | null) => parseStoredArray(value, environmentSchema);
