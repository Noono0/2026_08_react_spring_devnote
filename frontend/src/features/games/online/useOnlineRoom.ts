/**
 * useOnlineRoom.ts — 온라인 대전 방 하나와의 WebSocket 연결을 관리하는 훅
 *
 * [연결의 일생 = useEffect의 일생]
 *   화면이 열리면 연결하고 → 열리면 JOIN을 보내고 → 받은 메시지는 리듀서로 → 화면을 떠나면 cleanup에서 닫는다.
 *   cleanup에서 닫지 않으면 다른 화면으로 가도 연결이 남아 방에 "유령"이 계속 앉아 있게 된다.
 *
 * [cleanup에서 이벤트 연결을 먼저 끊는 이유]
 *   "다시 연결"을 누르면 새 연결을 만들기 전에 옛 연결을 닫는다. 이때 옛 연결의 onclose가 늦게 불리면
 *   새 연결이 "끊김"으로 잘못 표시된다. 그래서 닫기 전에 onopen·onmessage·onclose를 null로 비운다.
 *
 * [PING]
 *   아무 일 없이 조용하면 중간 장치(Nginx 등)가 연결을 끊는다. 25초마다 PING을 보내 연결을 살려 둔다.
 *
 * ★ 타이머·이벤트 안에서는 dispatch와 socket만 쓴다(state를 읽지 않음) → 오래된 클로저 걱정이 없다.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { buildOnlineSocketUrl } from "@/features/games/online/onlineApi";
import { initialOnlineRoomState, onlineRoomReducer, parseServerMessage } from "@/features/games/online/onlineRoomReducer";
import type { OnlineClientMessage } from "@/features/games/online/onlineTypes";
import { applicationLogger } from "@/shared/logging/applicationLogger";

export const PING_INTERVAL_MS = 25_000;

interface UseOnlineRoomOptions {
  roomId: string;
  /** 비회원 닉네임(회원은 서버가 회원 이름을 쓴다) */
  nickname: string;
  /** 방을 만든 사람의 표(있으면 비밀번호 없이 방장으로 들어간다) */
  hostToken?: string;
}

export const useOnlineRoom = ({ roomId, nickname, hostToken }: UseOnlineRoomOptions) => {
  const [state, dispatch] = useReducer(onlineRoomReducer, initialOnlineRoomState);
  const socketRef = useRef<WebSocket | null>(null);
  // 이 숫자를 바꾸면 아래 Effect가 다시 실행되어 새로 연결한다("다시 연결" 버튼)
  const [connectAttempt, setConnectAttempt] = useState(0);

  useEffect(() => {
    dispatch({ type: "CONNECTING" });
    const socket = new WebSocket(buildOnlineSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      dispatch({ type: "OPEN" });
      const join: OnlineClientMessage = { type: "JOIN", roomId, nickname, hostToken };
      socket.send(JSON.stringify(join));
    };
    socket.onmessage = (event: MessageEvent<unknown>) => {
      const message = parseServerMessage(event.data);
      if (message) dispatch({ type: "SERVER_MESSAGE", message });
      else applicationLogger.warn("[Online] 알 수 없는 서버 메시지를 무시했습니다.", { dataType: typeof event.data });
    };
    socket.onclose = (event: CloseEvent) => dispatch({ type: "CLOSED", reason: event.reason || null });

    const pingTimer = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "PING" } satisfies OnlineClientMessage));
    }, PING_INTERVAL_MS);

    return () => {
      window.clearInterval(pingTimer);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socketRef.current = null;
      socket.close(1000, "leave");
    };
  }, [roomId, nickname, hostToken, connectAttempt]);

  /**
   * 메시지 보내기. 연결이 열려 있지 않으면 보내지 않고 false.
   * ★ useCallback을 쓴 이유: 테트리스 대전은 "블록이 굳으면 판 보내기"를 Effect에서 하고, 그 Effect 의존성에 send가 들어간다.
   *   send가 그릴 때마다 새 함수면 Effect가 매번 다시 실행된다. socketRef만 쓰므로 한 번 만든 함수를 계속 써도 안전하다.
   */
  const send = useCallback((message: OnlineClientMessage): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  return {
    state,
    send,
    joinWithPassword: (password: string) => send({ type: "JOIN", roomId, nickname, hostToken, password }),
    reconnect: () => setConnectAttempt((previous) => previous + 1),
  };
};
