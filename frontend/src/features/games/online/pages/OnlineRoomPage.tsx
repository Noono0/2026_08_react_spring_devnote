/**
 * OnlineRoomPage.tsx — 온라인 대전 방(/games/online/:roomId)
 *
 * [들어가기 전에 확인하는 것]
 *   1. 주소의 방 번호 모양(8글자) — 주소는 누구나 고쳐 칠 수 있는 입력이라 먼저 검사한다
 *   2. 로그인 여부 — 비회원은 방에서 쓸 닉네임을 먼저 정한다(이 브라우저에 기억)
 *   3. 방을 만든 사람이면 대기실이 넘겨준 hostToken(location.state)을 함께 낸다
 * 그다음 OnlineRoomScreen이 WebSocket으로 연결한다. 연결은 닉네임이 정해진 뒤에만 시작되도록 컴포넌트를 나눴다.
 */
import { useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { z } from "zod";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { OnlineRoomScreen } from "@/features/games/online/pages/OnlineRoomScreen";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { PLAYER_NICKNAME_KEY as NICKNAME_KEY, playerNicknameSchema as nicknameSchema } from "@/features/games/shared/playerNickname";
import "@/features/games/shared/games.css";
import "@/features/games/online/online.css";

const ROOM_ID_PATTERN = /^[a-z0-9]{8}$/;
const locationStateSchema = z.object({ hostToken: z.string().min(1) });

export const OnlineRoomPage = () => {
  const { roomId = "" } = useParams();
  const location = useLocation();
  const sessionQuery = useAuthSessionQuery();
  const [nickname, setNickname] = useState(() => readGameRecord(NICKNAME_KEY, nicknameSchema) ?? "");
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // location.state도 믿을 수 없는 값이다(다른 화면이 아무 값이나 넣을 수 있다) → 모양을 확인한다
  const parsedState = locationStateSchema.safeParse(location.state);
  const hostToken = parsedState.success ? parsedState.data.hostToken : undefined;

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return (
      <section className="site-page online-page">
        <p className="portfolio-state-panel" role="alert">잘못된 방 주소입니다. <Link to="/games/online">대기실로 돌아가기</Link></p>
      </section>
    );
  }
  if (sessionQuery.isPending) return <section className="site-page online-page"><p className="portfolio-state-panel">로그인 정보를 확인하는 중입니다.</p></section>;

  const isLoggedIn = sessionQuery.data?.authenticated === true;

  if (!isLoggedIn && !nicknameConfirmed) {
    const confirm = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = nicknameSchema.safeParse(nickname);
      if (!result.success) {
        setNicknameError("닉네임은 2~12자로 입력해 주세요.");
        return;
      }
      writeGameRecord(NICKNAME_KEY, result.data);
      setNickname(result.data);
      setNicknameError(null);
      setNicknameConfirmed(true);
    };
    return (
      <section className="site-page online-page">
        <form className="online-panel online-nickname-form" onSubmit={confirm}>
          <h1>방에서 쓸 닉네임</h1>
          <p>로그인하지 않았으면 닉네임으로 참가합니다. 로그인하면 회원 이름을 씁니다.</p>
          <label>
            <span>닉네임 (2~12자)</span>
            <input value={nickname} maxLength={12} autoFocus onChange={(event) => setNickname(event.target.value)} aria-invalid={nicknameError ? true : undefined} />
          </label>
          {nicknameError ? <p className="field-error" role="alert">{nicknameError}</p> : null}
          <div className="button-row">
            <button type="submit">들어가기</button>
            <Link className="ghost-link" to="/games/online">대기실로</Link>
          </div>
        </form>
      </section>
    );
  }

  return (
    <OnlineRoomScreen
      // 닉네임을 바꿔 다시 들어오면 key가 바뀌어 연결도 새로 만든다
      key={`${roomId}:${isLoggedIn ? "member" : nickname}`}
      roomId={roomId}
      nickname={isLoggedIn ? "" : nickname}
      hostToken={hostToken}
      canUseMembersOnly={isLoggedIn}
      onChangeNickname={isLoggedIn ? undefined : () => setNicknameConfirmed(false)}
    />
  );
};
