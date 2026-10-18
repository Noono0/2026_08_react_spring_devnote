// deadline.ts — 서버가 보낸 마감 시각(epoch ms) 계산 도우미(DeadlineTimer가 쓴다)

/** 마감 시각까지 남은 초(0 밑으로는 내려가지 않음, 올림). 마감 시각이 없으면 null */
export const secondsLeft = (deadline: number | null | undefined, now: number): number | null =>
  deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
