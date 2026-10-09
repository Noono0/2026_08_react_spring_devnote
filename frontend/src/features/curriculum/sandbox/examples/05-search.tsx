/**
 * 5단계 연습 — 실시간 검색 자동완성: Effect, 디바운스, 요청 취소, 키보드 접근성
 *
 * 해 볼 것
 *  1. 디바운스 시간을 0으로 바꾸고, 글자마다 요청이 나가는 것을 콘솔에서 확인해 보세요.
 *  2. 검색어와 일치하는 부분을 <mark>로 강조해 보세요.
 */
import { useEffect, useState, type KeyboardEvent } from "react";

const TOPICS = ["useState", "useEffect", "useReducer", "useRef", "useMemo", "useCallback", "useContext", "Suspense", "React Query"];

// 서버 대신 쓰는 가짜 검색 API. AbortSignal로 중간에 취소할 수 있다.
const searchTopics = (keyword: string, signal: AbortSignal): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(TOPICS.filter((topic) => topic.toLowerCase().includes(keyword.toLowerCase()))), 400);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("취소됨", "AbortError")); });
  });

export default function App() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!keyword.trim()) return;
    const controller = new AbortController();
    // 디바운스: 입력이 300ms 멈춘 뒤에만 검색한다.
    const timer = setTimeout(() => {
      console.log("검색 요청:", keyword);
      setStatus("loading");
      searchTopics(keyword, controller.signal)
        .then((found) => { setResults(found); setStatus("done"); setActiveIndex(-1); })
        .catch((error: unknown) => {
          // 취소된 요청(이전 검색어)은 무시한다. 늦게 온 옛 결과가 화면을 덮어쓰지 않게.
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStatus("done");
        });
    }, 300);
    // 정리 함수: 검색어가 바뀌면 이전 타이머와 요청을 모두 취소한다.
    return () => { clearTimeout(timer); controller.abort(); };
  }, [keyword]);

  // 위·아래 화살표로 결과를 고르고 Enter로 확정한다.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && results[activeIndex]) setKeyword(results[activeIndex]);
  };

  const showResults = keyword.trim().length > 0;
  return (
    <main>
      <h1>검색 자동완성</h1>
      <input
        role="combobox"
        aria-expanded={showResults}
        aria-controls="topic-results"
        value={keyword}
        onChange={(event) => { setKeyword(event.target.value); if (!event.target.value.trim()) { setResults([]); setStatus("idle"); } }}
        onKeyDown={handleKeyDown}
        placeholder="use 를 입력해 보세요"
      />
      {status === "loading" ? <p className="muted">검색 중…</p> : null}
      {showResults ? (
        <ul id="topic-results" role="listbox" className="list">
          {results.map((topic, index) => (
            <li key={topic} role="option" aria-selected={index === activeIndex} style={{ background: index === activeIndex ? "var(--accent-soft)" : undefined }}>{topic}</li>
          ))}
          {status === "done" && results.length === 0 ? <li className="muted">결과가 없습니다.</li> : null}
        </ul>
      ) : null}
    </main>
  );
}
