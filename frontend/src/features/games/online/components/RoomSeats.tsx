/**
 * RoomSeats.tsx — 플레이어 자리와 관전자 목록
 *
 * 자리에 앉은 사람 = 플레이어, 나머지 = 관전자. 빈 자리를 누르면 앉고, 내 자리에서 "일어나기"를 누르면 관전자가 된다.
 * 게임 중에는 자리를 바꿀 수 없다(서버 규칙과 같음 — 버튼도 비활성).
 */
import { seatLabel } from "@/features/games/online/onlineRoomHelpers";
import type { OnlineRoom } from "@/features/games/online/onlineTypes";

interface RoomSeatsProperties {
  room: OnlineRoom;
  onSit: (seatIndex: number) => void;
  onStand: () => void;
}

export const RoomSeats = ({ room, onSit, onStand }: RoomSeatsProperties) => {
  const playing = room.status === "PLAYING";
  const byId = new Map(room.participants.map((participant) => [participant.participantId, participant]));
  const spectators = room.participants.filter((participant) => participant.seatIndex == null);
  const iAmSeated = room.seats.includes(room.myParticipantId);

  const nameWithBadges = (participantId: string) => {
    const participant = byId.get(participantId);
    if (!participant) return "(알 수 없음)";
    return (
      <>
        {participant.nickname}
        {participantId === room.myParticipantId ? <span className="online-badge me">나</span> : null}
        {participantId === room.hostId ? <span className="online-badge host">방장</span> : null}
        {participant.member ? <span className="online-badge member">회원</span> : null}
      </>
    );
  };

  return (
    <section className="online-panel" aria-label="플레이어와 관전자">
      <h2>플레이어 <small>{room.seats.filter(Boolean).length} / {room.seatCount}</small></h2>
      <ol className="online-seat-list">
        {room.seats.map((participantId, seatIndex) => (
          <li key={seatIndex} className={participantId ? "taken" : "empty"}>
            <span className="online-seat-label">{seatLabel(room.gameType, seatIndex)}</span>
            {participantId ? (
              <span className="online-seat-name">{nameWithBadges(participantId)}</span>
            ) : (
              <button type="button" className="ghost-button" disabled={playing} onClick={() => onSit(seatIndex)}>
                {iAmSeated ? "이 자리로 옮기기" : "앉기"}
              </button>
            )}
          </li>
        ))}
      </ol>
      {iAmSeated ? <button type="button" className="ghost-button online-stand-button" disabled={playing} onClick={onStand}>일어나서 관전하기</button> : null}

      <h2>관전자 <small>{spectators.length}명 · 방 인원 {room.participants.length} / {room.maxParticipants}</small></h2>
      {spectators.length === 0 ? <p className="online-empty">관전자가 없습니다.</p> : (
        <ul className="online-spectator-list">
          {spectators.map((participant) => <li key={participant.participantId}>{nameWithBadges(participant.participantId)}</li>)}
        </ul>
      )}
    </section>
  );
};
