/**
 * 1단계 연습 — React 기초: useState, 이벤트, 조건부 렌더링
 *
 * 해 볼 것
 *  1. 증가 단위를 5로 바꿔 보세요. (increase 함수)
 *  2. 입력한 이름을 아래 목록에 추가해 보세요. (names 배열 State)
 *  3. "설명 숨기기" 버튼으로 문단이 사라지는 원리를 확인하세요.
 */
import { useState } from "react";

export default function App() {
  // useState: 값이 바뀌면 React가 화면을 다시 그린다. [현재 값, 바꾸는 함수]
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(true);

  // 이전 값으로 다음 값을 계산할 때는 함수형 업데이트를 쓴다.
  const increase = () => setCount((previous) => previous + 1);

  const addName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // ❌ names.push(trimmed)  → 같은 배열을 고치면 React가 바뀐 줄 모른다.
    // ✓ 새 배열을 만들어 넘긴다(불변성).
    setNames((previous) => [...previous, trimmed]);
    setName("");
  };

  return (
    <main>
      <h1>React 기초</h1>
      {/* 조건부 렌더링: 조건이 true일 때만 그린다 */}
      {showHelp ? <p>버튼을 누르면 State가 바뀌고 화면이 다시 그려집니다.</p> : null}
      <button className="secondary" onClick={() => setShowHelp((previous) => !previous)}>
        {showHelp ? "설명 숨기기" : "설명 보기"}
      </button>

      <div className="card">
        <h2>카운터: {count}</h2>
        <div className="row">
          <button onClick={increase}>+1</button>
          <button className="secondary" onClick={() => setCount(0)}>초기화</button>
        </div>
      </div>

      <div className="card">
        <label>
          이름
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름을 입력하세요" />
        </label>
        <button onClick={addName}>목록에 추가</button>
        <ul className="list">
          {/* 목록의 key는 항목을 구분하는 값. 여기서는 연습용으로 이름+순서를 쓴다. */}
          {names.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      </div>
    </main>
  );
}
