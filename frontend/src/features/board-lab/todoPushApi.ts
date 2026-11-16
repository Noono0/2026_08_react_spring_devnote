import { z } from "zod";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";

const settingsSchema = z.object({ configured: z.boolean(), publicKey: z.string().max(100), subscribed: z.boolean() })
  .refine((settings) => !settings.configured || /^[A-Za-z0-9_-]{87}={0,1}$/.test(settings.publicKey));
export interface TodoPushSubscription { expectedOwnerKey: string; endpoint: string }
const path = "/board-todos/push";
export const todoPushApi = {
  async settings(signal?: AbortSignal) {
    return settingsSchema.parse((await selectedHttpClient.get<ApiResponse<unknown>>(path, { abortSignal: signal })).data);
  },
  async subscribe(subscription: TodoPushSubscription) {
    await selectedHttpClient.post<TodoPushSubscription, void>(`${path}/subscription`, subscription);
  },
  async unsubscribe(expectedOwnerKey: string) {
    await selectedHttpClient.delete<void>(`${path}/subscription`, { queryParameters: { expectedOwnerKey } });
  },
};
