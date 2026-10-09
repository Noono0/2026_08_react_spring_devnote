/**
 * 13단계 연습 — 관리자 사용자: 다중 선택(Set), 일괄 처리, Soft Delete와 복구
 *
 * 해 볼 것
 *  1. 선택한 사용자들을 한 번에 Soft Delete 하는 버튼을 추가해 보세요.
 *  2. 작업 후 선택 상태를 비우지 않으면 어떤 문제가 생기는지 확인해 보세요.
 */
import { useState } from "react";

type Role = "USER" | "ADMIN";
interface User { id: number; name: string; role: Role; deleted: boolean; }

export default function App() {
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: "김리액트", role: "USER", deleted: false },
    { id: 2, name: "박스프링", role: "USER", deleted: false },
    { id: 3, name: "최도커", role: "ADMIN", deleted: false },
  ]);
  // 선택한 ID 모음. Set은 "있는지 확인(has)"이 빠르고 중복이 없다.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleted, setShowDeleted] = useState(false);

  const visible = users.filter((user) => user.deleted === showDeleted);
  const allSelected = visible.length > 0 && visible.every((user) => selectedIds.has(user.id));

  const toggle = (id: number) => setSelectedIds((previous) => {
    // Set도 직접 고치지 않고 복사본을 만든다(불변성).
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(visible.map((user) => user.id)));

  const changeRole = (role: Role) => {
    setUsers((previous) => previous.map((user) => (selectedIds.has(user.id) ? { ...user, role } : user)));
    setSelectedIds(new Set()); // 일괄 작업 뒤에는 선택을 비운다.
  };

  // Soft Delete: 지우지 않고 deleted 표시만 한다. 나중에 복구할 수 있다.
  const setDeleted = (id: number, deleted: boolean) =>
    setUsers((previous) => previous.map((user) => (user.id === id ? { ...user, deleted } : user)));

  return (
    <main>
      <h1>관리자 사용자</h1>
      <div className="row">
        <button className="secondary" onClick={() => { setShowDeleted(!showDeleted); setSelectedIds(new Set()); }}>{showDeleted ? "활성 사용자 보기" : "삭제 사용자 보기"}</button>
        <button disabled={selectedIds.size === 0} onClick={() => changeRole("ADMIN")}>선택 {selectedIds.size}명 ADMIN으로</button>
        <button disabled={selectedIds.size === 0} className="secondary" onClick={() => changeRole("USER")}>USER로</button>
      </div>
      <table>
        <thead><tr><th><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" /></th><th>이름</th><th>역할</th><th>관리</th></tr></thead>
        <tbody>
          {visible.map((user) => (
            <tr key={user.id}>
              <td><input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggle(user.id)} aria-label={`${user.name} 선택`} /></td>
              <td>{user.name}</td>
              <td>{user.role}</td>
              <td>{user.deleted
                ? <button className="secondary" onClick={() => setDeleted(user.id, false)}>복구</button>
                : <button className="danger" onClick={() => setDeleted(user.id, true)}>삭제</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
