// mafiaRules.ts — 마피아: 서버가 보내는 화면 상태의 모양(zod)과 직업별 안내 문구
import { z } from "zod";

const roleSchema = z.enum(["MAFIA", "POLICE", "DOCTOR", "CITIZEN"]);

export type MafiaRole = z.infer<typeof roleSchema>;

export const mafiaSchema = z.object({
  mySeat: z.number().int().nullish(),
  /** 내 직업. 관전자는 없음 */
  myRole: roleSchema.nullish(),
  phase: z.enum(["NIGHT", "DAY", "END"]),
  round: z.number().int().min(1),
  /** role은 나에게 보여도 되는 경우만 온다(내 것·동료 마피아·게임 끝). done = 낮에 투표했는지 */
  players: z.array(z.object({ alive: z.boolean(), role: roleSchema.nullish(), done: z.boolean() })),
  /** 밤에 고른 사람 또는 낮에 투표한 사람(-1 = 건너뛰기) */
  myChoice: z.number().int().nullish(),
  /** 마피아에게만: 동료 마피아가 고른 사람 { 마피아 자리: 대상 자리 } */
  mafiaChoices: z.record(z.string(), z.number().int()),
  /** 경찰에게만: 지금까지의 조사 결과 */
  investigations: z.array(z.object({ seat: z.number().int(), mafia: z.boolean() })),
  log: z.array(z.string()),
  winnerTeam: z.string().nullish(),
  finished: z.boolean(),
});

export type MafiaView = z.infer<typeof mafiaSchema>;

export const SKIP_VOTE = -1;

export const roleInfo: Record<MafiaRole, { label: string; mission: string; nightButton: string | null }> = {
  MAFIA: { label: "마피아", mission: "밤마다 시민 한 명을 고릅니다. 마피아 수가 나머지와 같아지면 이깁니다.", nightButton: "지목" },
  POLICE: { label: "경찰", mission: "밤마다 한 명을 조사해 마피아인지 알아냅니다. 낮에 시민들을 설득하세요.", nightButton: "조사" },
  DOCTOR: { label: "의사", mission: "밤마다 한 명을 고르면 그 사람은 마피아에게 지목돼도 살아납니다(나도 가능).", nightButton: "살리기" },
  CITIZEN: { label: "시민", mission: "밤에는 기다리고, 낮에 대화와 투표로 마피아를 찾아 처형하세요.", nightButton: null },
};
