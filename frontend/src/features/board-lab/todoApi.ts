import { z } from "zod";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";

export const todoQueryRoot = ["board-todos"] as const;
export const todoStatuses = ["ALL", "ACTIVE", "DONE"] as const;
export type TodoStatus = typeof todoStatuses[number];
const ownerSchema = z.object({ mode: z.enum(["MEMBER", "GUEST"]), cacheKey: z.string().max(80) })
  .refine((owner) => owner.mode === "MEMBER" ? /^member:[1-9]\d*$/.test(owner.cacheKey)
    : /^guest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(owner.cacheKey));
export type TodoOwnerView = z.infer<typeof ownerSchema>;
const guestKey = z.string().regex(/^guest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const mergePreviewSchema = z.object({ count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), guestKey: guestKey.nullable(),
  throughTodoId: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
  .refine((preview) => preview.count === 0 || (preview.guestKey !== null && preview.throughTodoId > 0));
const mergeResultSchema = z.object({ mergedCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });
export interface TodoGuestMergeInput { expectedMemberId: number; guestKey: string; throughTodoId: number }
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const todoSchema = z.object({
  todoId: id, title: z.string().min(1).max(200), content: z.string().max(10000), completed: z.boolean(), versionNumber: id,
  createdAt: z.string().datetime({ local: true }), updatedAt: z.string().datetime({ local: true }),
  reminders: z.array(z.object({ reminderId: id, scheduledAt: z.string().datetime({ offset: true }),
    status: z.enum(["PENDING", "SENT", "CANCELLED", "FAILED", "EXPIRED"]) })).max(20).default([]),
});
export type Todo = z.infer<typeof todoSchema>;
export interface TodoInput { title: string; content: string; completed: boolean; versionNumber?: number; reminderTimes?: string[] }
const pageSchema = z.object({
  content: z.array(todoSchema),
  pageInformation: z.object({ pageNumber: z.number().int().nonnegative(), pageSize: id,
    totalElements: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), totalPages: z.number().int().nonnegative(),
    firstPage: z.boolean(), lastPage: z.boolean() }),
});
const path = "/board-todos";
export const todoApi = {
  async mergePreview(signal?: AbortSignal) {
    return mergePreviewSchema.parse((await selectedHttpClient.get<ApiResponse<unknown>>(`${path}/guest-merge`, { abortSignal: signal })).data);
  },
  async mergeGuest(input: TodoGuestMergeInput) {
    return mergeResultSchema.parse((await selectedHttpClient.post<TodoGuestMergeInput, ApiResponse<unknown>>(`${path}/guest-merge`, input)).data);
  },
  async owner(signal?: AbortSignal): Promise<TodoOwnerView> {
    return ownerSchema.parse((await selectedHttpClient.get<ApiResponse<unknown>>(`${path}/owner`, { abortSignal: signal })).data);
  },
  async list(status: TodoStatus, keyword: string, pageNumber: number, signal?: AbortSignal) {
    const result = await selectedHttpClient.get<ApiResponse<unknown>>(path, {
      queryParameters: { status, keyword, pageNumber, pageSize: 12 }, abortSignal: signal,
    });
    return pageSchema.parse(result.data);
  },
  async create(input: TodoInput): Promise<Todo> {
    return todoSchema.parse((await selectedHttpClient.post<TodoInput, ApiResponse<unknown>>(path, input)).data);
  },
  async update(todoId: number, input: TodoInput): Promise<Todo> {
    return todoSchema.parse((await selectedHttpClient.put<TodoInput, ApiResponse<unknown>>(`${path}/${todoId}`, input)).data);
  },
  async delete(todoId: number, versionNumber: number): Promise<void> {
    await selectedHttpClient.delete<void>(`${path}/${todoId}`, { queryParameters: { versionNumber } });
  },
};
