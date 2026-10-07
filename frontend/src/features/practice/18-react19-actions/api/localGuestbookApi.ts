/**
 * 방명록 글을 "서버에 저장하는 척"하는 가짜 API.
 * 0.7초 기다린 뒤 저장된 글(번호·작성 시각 포함)을 돌려준다.
 * 내용에 "error"가 들어 있으면 일부러 실패한다. → 낙관적 표시가 자동으로 되돌아가는지 확인용.
 */

export interface GuestbookMessage {
  messageId: number;
  authorName: string;
  content: string;
  createdAt: string;
}

const SIMULATED_NETWORK_DELAY_MILLISECONDS = 700;
// 서버 DB의 자동 증가 번호를 흉내 낸다. 모듈 변수라 페이지를 새로고침하면 처음(2)부터 다시 센다.
let lastMessageId = 2;

export const initialGuestbookMessages: GuestbookMessage[] = [
  { messageId: 2, authorName: "박스프링", content: "useActionState로 폼 상태가 한 곳에 모였어요.", createdAt: "2026-10-03T09:00:00.000Z" },
  { messageId: 1, authorName: "김리액트", content: "첫 방명록입니다.", createdAt: "2026-10-02T09:00:00.000Z" },
];

export const addGuestbookMessage = async (authorName: string, content: string): Promise<GuestbookMessage> => {
  // 일부러 0.7초 기다려 "저장 중" 표시(useOptimistic)를 눈으로 확인할 수 있게 한다.
  await new Promise((resolve) => window.setTimeout(resolve, SIMULATED_NETWORK_DELAY_MILLISECONDS));
  if (content.toLowerCase().includes("error")) throw new Error("방명록을 저장하지 못했습니다. (연습용 실패)");
  lastMessageId += 1;
  return { messageId: lastMessageId, authorName, content, createdAt: new Date().toISOString() };
};
