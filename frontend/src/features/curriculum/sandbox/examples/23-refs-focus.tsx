/**
 * 23단계 연습 — ref로 포커스·스크롤 다루기: useRef, 콜백 ref, 삭제 뒤 포커스 옮기기
 *
 * 해 볼 것
 *  1. 입력칸에서 Escape를 누르면 내용만 지우고 포커스는 유지해 보세요.
 *  2. 위·아래 화살표로 안건 사이를 이동하게 만들어 보세요.
 */
import { useRef, useState, type FormEvent } from "react";

interface Agenda { id: number; title: string; }

export default function App() {
  const [agendas, setAgendas] = useState<Agenda[]>([{ id: 1, title: "지난 회의 확인" }, { id: 2, title: "이번 주 일정" }]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  // useRef: 다시 그려도 유지되는 상자. .current에 실제 DOM 요소가 들어온다. 바뀌어도 화면은 다시 그리지 않는다.
  const inputRef = useRef<HTMLInputElement>(null);
  // 여러 요소의 ref는 Map에 모은다(콜백 ref).
  const itemRefs = useRef(new Map<number, HTMLLIElement>());

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("안건을 입력하세요.");
      inputRef.current?.focus(); // 오류가 난 칸으로 포커스를 옮긴다.
      return;
    }
    const id = Date.now();
    setAgendas((previous) => [...previous, { id, title: title.trim() }]);
    setTitle("");
    setError("");
    // 다음 화면이 그려진 뒤 새 항목으로 스크롤한다.
    requestAnimationFrame(() => itemRefs.current.get(id)?.scrollIntoView({ block: "nearest" }));
  };

  const remove = (id: number) => {
    setAgendas((previous) => previous.filter((agenda) => agenda.id !== id));
    // 삭제 버튼이 사라지면 포커스가 갈 곳을 잃는다. 입력칸으로 돌려보낸다.
    inputRef.current?.focus();
  };

  return (
    <main>
      <h1>회의 안건</h1>
      <form onSubmit={add} className="row">
        <input ref={inputRef} value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(error)} aria-describedby="agenda-error" placeholder="안건" />
        <button type="submit">추가</button>
      </form>
      <p id="agenda-error" className="error" role="alert">{error}</p>
      <ul className="list" style={{ maxHeight: 180, overflow: "auto" }}>
        {agendas.map((agenda) => (
          // 콜백 ref: 요소가 생기면 element, 사라지면 null로 불린다. Map에 넣고 뺀다.
          <li key={agenda.id} ref={(element) => { if (element) itemRefs.current.set(agenda.id, element); else itemRefs.current.delete(agenda.id); }}>
            {agenda.title}
            <button className="danger" onClick={() => remove(agenda.id)}>삭제</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
