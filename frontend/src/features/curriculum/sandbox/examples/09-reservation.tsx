/**
 * 9단계 연습 — 예약 관리: 시간 중복 검증과 상태 전이(정해진 순서로만 바뀌는 상태)
 *
 * 해 볼 것
 *  1. 지난 시간으로는 예약하지 못하게 막아 보세요.
 *  2. COMPLETED(이용 완료) 상태를 추가하고 CONFIRMED에서만 갈 수 있게 해 보세요.
 */
import { useState } from "react";

type Status = "REQUESTED" | "CONFIRMED" | "CANCELLED";
interface Reservation { id: number; room: string; start: string; end: string; status: Status; }

// 상태 전이 규칙: 지금 상태에서 갈 수 있는 다음 상태 목록
const nextStatuses: Record<Status, Status[]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [],
};

// 두 시간 구간이 겹치는가? (시작 < 상대 끝) 그리고 (끝 > 상대 시작)
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && a.end > b.start;

export default function App() {
  const [reservations, setReservations] = useState<Reservation[]>([
    { id: 1, room: "회의실 A", start: "2026-10-10T10:00", end: "2026-10-10T11:00", status: "CONFIRMED" },
  ]);
  const [room, setRoom] = useState("회의실 A");
  const [start, setStart] = useState("2026-10-10T10:30");
  const [end, setEnd] = useState("2026-10-10T11:30");
  const [error, setError] = useState("");

  const reserve = () => {
    if (start >= end) { setError("끝 시간은 시작 시간보다 늦어야 합니다."); return; }
    // 취소되지 않은 같은 방 예약과 겹치면 거절한다(서버라면 409 Conflict).
    const conflict = reservations.some((item) => item.room === room && item.status !== "CANCELLED" && overlaps(item, { start, end }));
    if (conflict) { setError("이미 예약된 시간과 겹칩니다."); return; }
    setReservations((previous) => [...previous, { id: Date.now(), room, start, end, status: "REQUESTED" }]);
    setError("");
  };

  const changeStatus = (id: number, status: Status) =>
    setReservations((previous) => previous.map((item) => (item.id === id ? { ...item, status } : item)));

  return (
    <main>
      <h1>예약 관리</h1>
      <div className="card">
        <label>회의실<select value={room} onChange={(event) => setRoom(event.target.value)}><option>회의실 A</option><option>회의실 B</option></select></label>
        <label>시작<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>끝<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <button onClick={reserve}>예약 요청</button>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </div>
      <ul className="list">
        {reservations.map((item) => (
          <li key={item.id}>
            <span className="badge">{item.status}</span>
            <span>{item.room} · {item.start.replace("T", " ")} ~ {item.end.slice(11)}</span>
            {nextStatuses[item.status].map((status) => (
              <button key={status} className="secondary" onClick={() => changeStatus(item.id, status)}>{status}로 변경</button>
            ))}
          </li>
        ))}
      </ul>
    </main>
  );
}
