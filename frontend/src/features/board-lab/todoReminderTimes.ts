import type { Todo } from "./todoApi";

export interface ReminderDraft { id: string; localTime: string; originalTime?: string }
export const reminderStatusLabels = { PENDING: "발송 대기", SENT: "푸시 서비스 접수", CANCELLED: "완료로 취소", FAILED: "발송 실패", EXPIRED: "기간 만료" };

export function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function reminderDrafts(todo?: Todo): ReminderDraft[] {
  return (todo?.reminders ?? []).map((reminder) => ({ id: String(reminder.reminderId),
    localTime: toLocalDateTime(reminder.scheduledAt), originalTime: reminder.scheduledAt }));
}

/** 입력은 기기 현지 시간, API는 UTC ISO 문자열이다. / Local input is converted to UTC at the API boundary. */
export function parseReminderDrafts(drafts: ReminderDraft[], now = Date.now()): string[] {
  const times = drafts.map((draft) => {
    if (!draft.localTime) throw new Error("추가한 알림 시간을 모두 입력하거나 필요 없는 항목을 삭제해 주세요.");
    const date = new Date(draft.localTime);
    if (!Number.isFinite(date.getTime()) || toLocalDateTime(date.toISOString()) !== draft.localTime) {
      throw new Error("유효한 알림 날짜와 시간을 입력해 주세요.");
    }
    if (draft.originalTime && toLocalDateTime(draft.originalTime) === draft.localTime) return draft.originalTime;
    if (date.getTime() <= now) throw new Error("새 알림은 현재 이후의 시간으로 설정해 주세요.");
    if (date.getTime() > now + 366 * 5 * 86400000) throw new Error("알림은 5년 이내의 시간으로 설정해 주세요.");
    return date.toISOString();
  });
  if (new Set(times.map((time) => new Date(time).getTime())).size !== times.length) throw new Error("동일한 알림 시간은 한 번만 추가해 주세요.");
  return times;
}
