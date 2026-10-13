/**
 * RoomChat.tsx — 방 채팅
 *
 * ★ 받은 글은 {chat.text}처럼 "글자"로만 넣는다. React는 글자 안의 <script> 같은 태그를 실행하지 않고 그대로 보여 준다.
 *   dangerouslySetInnerHTML로 넣으면 다른 사람이 보낸 코드가 내 브라우저에서 실행될 수 있다(XSS). 절대 쓰지 않는다.
 *
 * 새 채팅이 오면 목록을 맨 아래로 내린다(useEffect — 화면 DOM을 직접 움직이는 일).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { OnlineChat } from "@/features/games/online/onlineTypes";

export const CHAT_MAX_LENGTH = 200;
/** 서버 OnlineParticipant와 같은 도배 막기 규칙: 1초 안에 2개까지 */
export const CHAT_LIMIT_PER_WINDOW = 2;
export const CHAT_WINDOW_MS = 1_000;

interface RoomChatProperties {
  chats: OnlineChat[];
  disabled: boolean;
  onSend: (text: string) => boolean;
}

const formatTime = (millis: number) => new Date(millis).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

export const RoomChat = ({ chats, disabled, onSend }: RoomChatProperties) => {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const lastChatId = chats.at(-1)?.chatId;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lastChatId]);

  // 최근에 보낸 시각들. 화면에 그릴 값이 아니라 ref에 둔다
  const recentSendTimesRef = useRef<number[]>([]);
  const [isTooFast, setIsTooFast] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    // 서버와 같은 규칙(1초에 2개)을 화면에서도 먼저 확인한다. 서버가 거절하면 쓴 글이 사라지므로, 보내기 전에 막고 글은 남겨 둔다
    const now = Date.now();
    const recent = recentSendTimesRef.current.filter((sentAt) => now - sentAt < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_LIMIT_PER_WINDOW) {
      setIsTooFast(true);
      return;
    }
    if (onSend(trimmed)) { // 보내지 못했으면(연결 끊김) 쓴 글을 지우지 않는다
      recentSendTimesRef.current = [...recent, now];
      setText("");
      setIsTooFast(false);
    }
  };

  return (
    <section className="online-panel online-chat" aria-label="채팅">
      <h2>채팅</h2>
      {/* role="log": 새 줄이 붙는 기록. 화면 낭독기가 새 채팅을 읽어 준다 */}
      <ol ref={listRef} className="online-chat-list" role="log" aria-live="polite">
        {chats.length === 0 ? <li className="online-empty">아직 대화가 없습니다.</li> : null}
        {chats.map((chat) => (
          <li key={chat.chatId} className={chat.system ? "system" : chat.spectator ? "spectator" : ""}>
            {chat.system ? <span>{chat.text}</span> : (
              <>
                <strong>{chat.nickname}{chat.spectator ? <small> (관전)</small> : null}</strong>
                <span>{chat.text}</span>
              </>
            )}
            <time dateTime={new Date(chat.sentAt).toISOString()}>{formatTime(chat.sentAt)}</time>
          </li>
        ))}
      </ol>
      <form className="online-chat-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="online-chat-input">채팅 입력</label>
        <input
          id="online-chat-input"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={disabled ? "연결되면 채팅할 수 있습니다" : "메시지 입력 (200자까지)"}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" disabled={disabled || text.trim().length === 0}>보내기</button>
      </form>
      {isTooFast ? <p className="field-error" role="alert">너무 빠르게 보내고 있습니다. 잠시 후 다시 보내 주세요. (1초에 2개까지)</p> : null}
    </section>
  );
};
