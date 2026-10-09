/**
 * 19단계 연습 — 커스텀 훅: 반복되는 상태 로직을 use로 시작하는 함수로 빼내기
 *
 * 해 볼 것
 *  1. useToggle(initial) 훅을 만들어 "완료" 체크에 써 보세요.
 *  2. useDebouncedValue의 지연 시간을 1000으로 바꿔 차이를 느껴 보세요.
 */
import { useEffect, useState } from "react";

// 1) 입력이 멈춘 뒤에만 값을 바꿔 주는 훅
function useDebouncedValue<Value>(value: Value, delay: number): Value {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // 값이 또 바뀌면 이전 타이머 취소
  }, [value, delay]);
  return debounced;
}

// 2) localStorage에 저장되는 State. 깨진 저장값이면 초기값을 쓴다.
function useLocalStorageState(key: string, initial: string[]): [string[], (next: string[]) => void] {
  const [value, setValue] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : initial;
    } catch {
      return initial;
    }
  });
  const save = (next: string[]) => { setValue(next); localStorage.setItem(key, JSON.stringify(next)); };
  return [value, save];
}

// 3) 온라인 여부를 알려 주는 훅(브라우저 이벤트 구독 + 정리)
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

export default function App() {
  const [memos, setMemos] = useLocalStorageState("sandbox-memos", ["커스텀 훅 정리하기"]);
  const [newMemo, setNewMemo] = useState("");
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const online = useOnlineStatus();

  return (
    <main>
      <h1>읽을거리 메모 <span className="badge">{online ? "온라인" : "오프라인"}</span></h1>
      <div className="row">
        <input value={newMemo} onChange={(event) => setNewMemo(event.target.value)} placeholder="새 메모" />
        <button onClick={() => { if (newMemo.trim()) { setMemos([...memos, newMemo.trim()]); setNewMemo(""); } }}>추가</button>
      </div>
      <label>검색(0.3초 뒤 반영)<input value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label>
      <ul className="list">{memos.filter((memo) => memo.includes(debouncedKeyword)).map((memo) => <li key={memo}>{memo}</li>)}</ul>
    </main>
  );
}
