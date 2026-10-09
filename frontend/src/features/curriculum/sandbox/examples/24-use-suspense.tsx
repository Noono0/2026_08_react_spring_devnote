/**
 * 24단계 연습 — React 19 use()와 Suspense, Error Boundary
 *
 * 해 볼 것
 *  1. "실패시키기"를 켜고 다시 불러와 Error Boundary가 오류 화면을 그리는지 보세요.
 *  2. 공지 목록과 요약을 서로 다른 Suspense로 감싸 따로 나타나게 해 보세요.
 */
import { Component, Suspense, use, useState, type ReactNode } from "react";

interface Notice { id: number; title: string; }

// ★ Promise는 "렌더링할 때마다 새로" 만들면 무한 반복된다. 요청 번호별로 보관해 같은 Promise를 쓴다.
const promiseCache = new Map<string, Promise<Notice[]>>();
const getNotices = (attempt: number, fail: boolean): Promise<Notice[]> => {
  const key = `${attempt}-${fail}`;
  const cached = promiseCache.get(key);
  if (cached) return cached;
  const created = new Promise<Notice[]>((resolve, reject) => {
    setTimeout(() => (fail ? reject(new Error("공지를 불러오지 못했습니다.")) : resolve([{ id: 1, title: "점검 안내" }, { id: 2, title: "새 기능 소개" }])), 800);
  });
  promiseCache.set(key, created);
  return created;
};

// use(): Promise가 끝날 때까지 이 컴포넌트를 "잠시 멈춤" → 가장 가까운 Suspense가 fallback을 보여 준다.
function NoticeList({ promise }: { promise: Promise<Notice[]> }) {
  const notices = use(promise);
  return <ul className="list">{notices.map((notice) => <li key={notice.id}>{notice.title}</li>)}</ul>;
}

// Error Boundary: 자식에서 던진 오류를 잡아 대신 그린다. 아직은 클래스 컴포넌트로만 만들 수 있다.
class ErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="card" role="alert">
          <p className="error">{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); this.props.onRetry(); }}>다시 시도</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [attempt, setAttempt] = useState(1);
  const [fail, setFail] = useState(false);
  const retry = () => setAttempt((current) => current + 1);

  return (
    <main>
      <h1>공지 목록</h1>
      <label className="row"><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />실패시키기</label>
      <button className="secondary" onClick={retry}>다시 불러오기 (요청 {attempt})</button>
      <ErrorBoundary key={attempt} onRetry={retry}>
        <Suspense fallback={<p>불러오는 중…</p>}>
          <NoticeList promise={getNotices(attempt, fail)} />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}
