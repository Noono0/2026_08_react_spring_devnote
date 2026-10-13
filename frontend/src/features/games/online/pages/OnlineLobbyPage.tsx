/**
 * OnlineLobbyPage.tsx — 온라인 대전 대기실(/games/online)
 *
 * [서버 상태는 TanStack Query로]
 *   방 목록은 서버에 있는 값이라 useState로 들고 있지 않고 useQuery로 받는다.
 *   refetchInterval: 5초마다 다시 받아 새 방·인원 변화를 보여 준다(대기실까지 WebSocket을 쓸 필요는 없다).
 *
 * 방을 만들면 서버가 준 hostToken을 "주소 이동 상태(location.state)"에 담아 방 화면으로 넘긴다.
 * 주소창(URL)에 넣지 않는 이유: 주소는 다른 사람에게 공유되거나 기록에 남는다. 표가 새면 남이 방장이 될 수 있다.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { OnlineRoomForm } from "@/features/games/online/components/OnlineRoomForm";
import type { OnlineRoomFormValues } from "@/features/games/online/onlineRoomHelpers";
import { createOnlineRoom, getOnlineGameTypes, getOnlineRooms, onlineQueryKeys } from "@/features/games/online/onlineApi";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import "@/features/games/shared/games.css";
import "@/features/games/online/online.css";

export const ROOM_LIST_REFRESH_MS = 5_000;

const defaultFormValues: OnlineRoomFormValues = { title: "", gameType: "OMOK", seatCount: 2, password: "", passwordMode: "CHANGE", membersOnly: false };

export const OnlineLobbyPage = () => {
  const navigate = useNavigate();
  const sessionQuery = useAuthSessionQuery();
  const isLoggedIn = sessionQuery.data?.authenticated === true;
  const [isCreating, setIsCreating] = useState(false);

  const gameTypesQuery = useQuery({ queryKey: onlineQueryKeys.gameTypes, queryFn: getOnlineGameTypes, staleTime: Infinity });
  const roomsQuery = useQuery({ queryKey: onlineQueryKeys.rooms, queryFn: getOnlineRooms, refetchInterval: ROOM_LIST_REFRESH_MS });

  const createMutation = useMutation({
    mutationFn: (values: OnlineRoomFormValues) => createOnlineRoom({
      title: values.title.trim(), gameType: values.gameType, seatCount: values.seatCount, password: values.password, membersOnly: values.membersOnly,
    }),
    onSuccess: (created) => void navigate(`/games/online/${created.roomId}`, { state: { hostToken: created.hostToken } }),
    onError: (requestError) => applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError)),
  });

  const rooms = roomsQuery.data ?? [];

  return (
    <section className="site-page online-page">
      <div className="page-hero">
        <span className="page-kicker">Online Battle</span>
        <h1>온라인 대전</h1>
        <p>방을 만들거나 들어가 다른 사람과 실시간으로 겨룹니다. 자리에 앉으면 플레이어, 앉지 않으면 관전자이고, 방 안에서 채팅할 수 있습니다.</p>
      </div>

      <div className="utility-home-notice">
        <strong>서버 부담을 줄이는 방식</strong>
        <p>방·자리·채팅은 서버 메모리에만 두고 DB에 저장하지 않습니다. 사람이 없는 방은 1분 뒤 사라지고, 서버를 다시 켜면 모든 방이 없어집니다. 방은 관전자 포함 10명까지 들어갈 수 있습니다.</p>
      </div>

      <section className="online-panel" aria-labelledby="online-create-heading">
        <div className="online-panel-heading">
          <h2 id="online-create-heading">방 만들기</h2>
          {!isCreating ? <button type="button" onClick={() => setIsCreating(true)} disabled={!gameTypesQuery.data}>새 방 만들기</button> : null}
        </div>
        {gameTypesQuery.isError ? <p className="field-error" role="alert">게임 목록을 불러오지 못했습니다. 백엔드 서버가 켜져 있는지 확인해 주세요.</p> : null}
        {isCreating && gameTypesQuery.data ? (
          <OnlineRoomForm
            mode="create"
            gameTypes={gameTypesQuery.data}
            defaultValues={defaultFormValues}
            canUseMembersOnly={isLoggedIn}
            submitting={createMutation.isPending}
            submitLabel="만들고 들어가기"
            onSubmit={(values) => createMutation.mutate(values)}
            onCancel={() => setIsCreating(false)}
          />
        ) : null}
      </section>

      <section className="online-panel" aria-labelledby="online-rooms-heading">
        <div className="online-panel-heading">
          <h2 id="online-rooms-heading">방 목록 <small>{rooms.length}개</small></h2>
          <button type="button" className="ghost-button" onClick={() => void roomsQuery.refetch()} disabled={roomsQuery.isFetching}>
            {roomsQuery.isFetching ? "불러오는 중..." : "새로고침"}
          </button>
        </div>
        {roomsQuery.isPending ? <p className="portfolio-state-panel">방 목록을 불러오는 중입니다.</p> : null}
        {roomsQuery.isError ? <p className="field-error" role="alert">방 목록을 불러오지 못했습니다. 온라인 대전은 백엔드 서버가 있어야 동작합니다.</p> : null}
        {roomsQuery.isSuccess && rooms.length === 0 ? <p className="online-empty">아직 방이 없습니다. 첫 방을 만들어 보세요.</p> : null}
        {rooms.length > 0 ? (
          <ul className="online-room-list">
            {rooms.map((room) => {
              const blocked = room.membersOnly && !isLoggedIn;
              return (
                <li key={room.roomId} className="online-room-card">
                  <div className="online-room-card-main">
                    <strong>{room.title}</strong>
                    <span className="online-room-meta">
                      {room.gameTypeLabel} · 플레이어 {room.playerCount}/{room.seatCount} · 방 인원 {room.participantCount}/{room.maxParticipants}
                      {room.hostNickname ? ` · 방장 ${room.hostNickname}` : ""}
                    </span>
                    <span className="online-room-badges">
                      <span className={`online-badge ${room.status === "PLAYING" ? "playing" : "waiting"}`}>{room.status === "PLAYING" ? "게임 중" : "대기 중"}</span>
                      {room.hasPassword ? <span className="online-badge">🔒 비밀번호</span> : null}
                      {room.membersOnly ? <span className="online-badge member">로그인 유저만</span> : null}
                    </span>
                  </div>
                  {blocked ? (
                    <span className="online-room-blocked">로그인 필요</span>
                  ) : (
                    <Link className="online-enter-link" to={`/games/online/${room.roomId}`} aria-label={`${room.title} 방 들어가기`}>들어가기</Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </section>
  );
};
