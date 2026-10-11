/**
 * OnlineRoomScreen.tsx — 연결된 방 화면(판·자리·채팅·방장 메뉴)
 *
 * 모든 조작은 send(...)로 서버에 "부탁"만 하고, 결과는 서버가 보낸 ROOM_STATE로 다시 그린다.
 * 그래서 이 화면에는 게임 규칙이 없다(규칙은 서버 OnlineRoom·OmokGame에 있다).
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { OmokBoard } from "@/features/games/online/components/OmokBoard";
import { OnlineRoomForm } from "@/features/games/online/components/OnlineRoomForm";
import { OnlineTetrisGame } from "@/features/games/online/components/OnlineTetrisGame";
import { CommonGameArea } from "@/features/games/online/games/CommonGameArea";
import { RoomChat } from "@/features/games/online/components/RoomChat";
import { RoomSeats } from "@/features/games/online/components/RoomSeats";
import { getOnlineGameTypes, onlineQueryKeys } from "@/features/games/online/onlineApi";
import { seatLabel, toRoomSettings } from "@/features/games/online/onlineRoomHelpers";
import { findMe } from "@/features/games/online/onlineRoomReducer";
import type { OnlineRoom } from "@/features/games/online/onlineTypes";
import { useOnlineRoom } from "@/features/games/online/useOnlineRoom";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

/** 들어가기 전에 나는 오류 중 "다시 시도해도 안 되는" 것 → 대기실로 안내 */
const FATAL_JOIN_ERRORS = new Set(["ONLINE_ROOM_NOT_FOUND", "ONLINE_ROOM_FULL", "ONLINE_ROOM_MEMBERS_ONLY"]);
const NICKNAME_ERRORS = new Set(["ONLINE_NICKNAME_INVALID", "ONLINE_NICKNAME_TAKEN"]);
/** 방 안에서 받은 오류 알림은 잠깐 보여 주고 지운다 */
export const ERROR_VISIBLE_MS = 4_000;

interface OnlineRoomScreenProperties {
  roomId: string;
  nickname: string;
  hostToken?: string;
  canUseMembersOnly: boolean;
  onChangeNickname?: () => void;
}

/** 판 아래 한 줄 안내: 누구 차례인지, 지난 판 결과, 시작 조건 */
const describeStatus = (room: OnlineRoom, mySeat: number | null): string => {
  const nicknameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? "(빈자리)";
  // 공통 틀 게임은 게임 화면이 자기 진행 상황을 보여 준다
  if (room.status === "PLAYING" && room.game != null) return "";
  if (room.status === "PLAYING" && room.tetris) {
    const alive = room.tetris.players.filter((player) => player.alive).length;
    const me = mySeat === null ? undefined : room.tetris.players[mySeat];
    return `살아남은 사람 ${alive}명${me && !me.alive ? ` — 나는 ${me.rank}위로 탈락` : ""}`;
  }
  if (room.status === "PLAYING" && room.omok) {
    const turn = room.omok.turnSeat;
    return `${seatLabel(room.gameType, turn)} ${nicknameAt(turn)} 차례${mySeat === turn ? " — 내 차례입니다!" : ""}`;
  }
  if (room.lastResult) return `게임 끝: ${room.lastResult}`;
  return room.seats.includes(null) ? `플레이어 ${room.seatCount}명이 모두 앉으면 방장이 시작할 수 있습니다.` : "모두 앉았습니다. 방장이 시작하면 게임이 시작됩니다.";
};

export const OnlineRoomScreen = ({ roomId, nickname, hostToken, canUseMembersOnly, onChangeNickname }: OnlineRoomScreenProperties) => {
  const { state, send, joinWithPassword, reconnect } = useOnlineRoom({ roomId, nickname, hostToken });
  const gameTypesQuery = useQuery({ queryKey: onlineQueryKeys.gameTypes, queryFn: getOnlineGameTypes, staleTime: Infinity });
  const [password, setPassword] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResignOpen, setIsResignOpen] = useState(false);
  const { room, connection, lastError } = state;
  const isOpen = connection === "OPEN";
  // 마지막으로 숨긴 오류 번호. 새 오류(sequence 증가)가 오면 다시 보이고, 4초 뒤 타이머가 숨긴다
  const [hiddenErrorSequence, setHiddenErrorSequence] = useState(0);
  const errorSequence = lastError?.sequence ?? 0;
  useEffect(() => {
    if (errorSequence === 0) return;
    const timeoutId = window.setTimeout(() => setHiddenErrorSequence(errorSequence), ERROR_VISIBLE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [errorSequence]);
  const visibleError = lastError && lastError.sequence > hiddenErrorSequence ? lastError : null;

  // ── 아직 방에 들어가지 못한 상태 ─────────────────────────────
  if (!room) {
    const joinError = lastError && (FATAL_JOIN_ERRORS.has(lastError.code) || NICKNAME_ERRORS.has(lastError.code)) ? lastError : null;
    const submitPassword = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (password) joinWithPassword(password);
    };
    return (
      <section className="site-page online-page">
        <div className="online-panel online-join-panel">
          {connection === "CONNECTING" ? <p role="status">서버에 연결하는 중입니다...</p> : null}
          {connection === "CLOSED" ? (
            <div role="alert">
              <p>{state.closedReason ?? "서버와 연결되지 않았습니다. 백엔드 서버가 켜져 있는지 확인해 주세요."}</p>
              <button type="button" onClick={reconnect}>다시 연결</button>
            </div>
          ) : null}
          {isOpen && state.passwordRequired ? (
            <form className="online-password-form" onSubmit={submitPassword}>
              <h1>비밀번호가 있는 방입니다</h1>
              <label>
                <span>방 비밀번호</span>
                <input type="password" autoComplete="off" autoFocus maxLength={20} value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              {lastError?.code === "ONLINE_ROOM_PASSWORD_INVALID" ? <p className="field-error" role="alert">{lastError.message} (5번 틀리면 연결이 끊깁니다)</p> : null}
              <button type="submit" disabled={!password}>들어가기</button>
            </form>
          ) : null}
          {isOpen && !state.passwordRequired && !joinError ? <p role="status">방에 들어가는 중입니다...</p> : null}
          {joinError ? (
            <div role="alert">
              <p>{joinError.message}</p>
              {NICKNAME_ERRORS.has(joinError.code) && onChangeNickname ? <button type="button" onClick={onChangeNickname}>닉네임 바꾸기</button> : null}
            </div>
          ) : null}
          <Link className="ghost-link" to="/games/online">대기실로 돌아가기</Link>
        </div>
      </section>
    );
  }

  // ── 방 안 ───────────────────────────────────────────────────
  const { mySeat, isHost } = findMe(room);
  const playing = room.status === "PLAYING";
  const canPlace = isOpen && playing && room.omok != null && mySeat === room.omok.turnSeat;
  const seatsFull = !room.seats.includes(null);
  const isTetris = room.gameType === "TETRIS";
  const isCommonGame = room.gameType !== "TETRIS" && room.gameType !== "OMOK";
  const statusText = describeStatus(room, mySeat);
  // 기권: 오목은 진행 중인 플레이어, 테트리스는 아직 살아 있는 플레이어만
  const canResign = playing && mySeat !== null && (!isTetris || room.tetris?.players[mySeat]?.alive === true);

  return (
    <section className="site-page online-page">
      <header className="online-room-header">
        <div>
          <span className="page-kicker">Online · {room.gameTypeLabel} · 방 번호 {room.roomId}</span>
          <h1>{room.title}</h1>
          <span className="online-room-badges">
            <span className={`online-badge ${playing ? "playing" : "waiting"}`}>{playing ? "게임 중" : "대기 중"}</span>
            {room.hasPassword ? <span className="online-badge">🔒 비밀번호</span> : null}
            {room.membersOnly ? <span className="online-badge member">로그인 유저만</span> : null}
            <span className={`online-badge connection-${connection.toLowerCase()}`}>{isOpen ? "연결됨" : connection === "CONNECTING" ? "연결 중" : "연결 끊김"}</span>
          </span>
        </div>
        <div className="button-row">
          {isHost ? <button type="button" className="ghost-button" disabled={!isOpen || !gameTypesQuery.data} onClick={() => setIsEditOpen(true)}>방 정보 수정</button> : null}
          <Link className="ghost-link" to="/games/online">나가기</Link>
        </div>
      </header>

      {connection === "CLOSED" ? (
        <div className="online-banner" role="alert">
          <span>{state.closedReason ?? "서버와 연결이 끊겼습니다."}</span>
          <button type="button" onClick={reconnect}>다시 연결</button>
        </div>
      ) : null}
      {visibleError ? <p key={visibleError.sequence} className="online-banner warning" role="alert">{visibleError.message}</p> : null}

      <div className={`online-room-layout${isTetris ? " wide" : ""}`}>
        <div className="online-game-area">
          {isTetris ? (
            <OnlineTetrisGame room={room} mySeat={mySeat} connected={isOpen} incomingGarbage={state.incomingGarbage} send={send} />
          ) : isCommonGame ? (
            <CommonGameArea room={room} mySeat={mySeat} connected={isOpen} send={send} />
          ) : (
            <OmokBoard omok={room.omok} canPlace={canPlace} onPlace={(row, col) => send({ type: "OMOK_PLACE", row, col })} />
          )}
          {statusText ? <p className={`game-status${room.lastResult && !playing ? " success" : ""}`} aria-live="polite">{statusText}</p> : null}
          <div className="button-row">
            {isHost && !playing ? (
              <button type="button" disabled={!isOpen || !seatsFull} onClick={() => send({ type: "START" })}>
                {room.lastResult ? "다시 시작" : "게임 시작"}
              </button>
            ) : null}
            {canResign ? <button type="button" className="danger-button" disabled={!isOpen} onClick={() => setIsResignOpen(true)}>기권</button> : null}
            {mySeat === null ? <span className="online-hint">관전 중입니다. 빈 자리에 앉으면 다음 판부터 플레이할 수 있습니다.</span> : null}
          </div>
        </div>

        <div className="online-side">
          <RoomSeats room={room} onSit={(seatIndex) => send({ type: "SIT", seatIndex })} onStand={() => send({ type: "STAND" })} />
          <RoomChat chats={state.chats} disabled={!isOpen} onSend={(text) => send({ type: "CHAT", text })} />
        </div>
      </div>

      {gameTypesQuery.data ? (
        <ModalDialog isOpen={isEditOpen} title="방 정보 수정" description="방장만 바꿀 수 있습니다. 바꾼 내용은 방 사람 모두에게 바로 보입니다." onRequestClose={() => setIsEditOpen(false)}>
          {isEditOpen ? (
            <OnlineRoomForm
              mode="edit"
              gameTypes={gameTypesQuery.data}
              defaultValues={{ title: room.title, gameType: room.gameType, seatCount: room.seatCount, password: "", passwordMode: room.hasPassword ? "KEEP" : "CHANGE", membersOnly: room.membersOnly }}
              hasPassword={room.hasPassword}
              canUseMembersOnly={canUseMembersOnly}
              gameLocked={playing}
              submitLabel="저장"
              onSubmit={(values) => {
                if (send({ type: "UPDATE_ROOM", settings: toRoomSettings(values, room.hasPassword) })) setIsEditOpen(false);
              }}
              onCancel={() => setIsEditOpen(false)}
            />
          ) : null}
        </ModalDialog>
      ) : null}

      <ConfirmDialog
        isOpen={isResignOpen}
        title="기권"
        description={isTetris || isCommonGame ? "기권하면 나만 빠지고 나머지 사람은 계속합니다(혼자 남으면 그 사람이 이깁니다). 기권할까요?" : "기권하면 상대가 이깁니다. 기권할까요?"}
        confirmButtonLabel="기권"
        onConfirm={() => {
          send({ type: "RESIGN" });
          setIsResignOpen(false);
        }}
        onCancel={() => setIsResignOpen(false)}
      />
    </section>
  );
};
