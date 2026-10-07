/**
 * ============================================================================
 * CustomHooksPracticePage.tsx — 【고급】 커스텀 훅으로 반복 로직 분리하기
 * ============================================================================
 *
 * "읽을거리 메모장" 화면이다. 페이지에는 화면 그리기만 남기고, 반복되는 동작은 훅 세 개로 뺐다.
 *
 *   useLocalStorageState → 메모 목록을 새로고침해도 유지 (3단계 연락처의 저장 코드를 훅으로)
 *   useDebouncedValue    → 검색어가 멈췄을 때만 거르기   (5단계 검색의 타이머 코드를 훅으로)
 *   useOnlineStatus      → 인터넷 연결 상태 표시         (useSyncExternalStore로 브라우저 값 구독)
 *
 * [확인할 것]
 *   1. 메모를 추가하고 새로고침해도 남는다. (개발자 도구 → Application → Local Storage에서 값 확인)
 *   2. 검색어를 빠르게 치면 목록은 입력이 멈춘 뒤 한 번만 바뀐다. "실제로 거른 검색어"를 같이 보여 준다.
 *   3. 개발자 도구 Network 탭에서 Offline을 켜면 상태 표시가 바뀐다.
 *   4. 훅 파일을 열어 보면 페이지에 있던 useEffect가 전부 그쪽으로 옮겨져 있다.
 */

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { useDebouncedValue } from "@/features/practice/19-custom-hooks/hooks/useDebouncedValue";
import { useLocalStorageState } from "@/features/practice/19-custom-hooks/hooks/useLocalStorageState";
import { useOnlineStatus } from "@/features/practice/19-custom-hooks/hooks/useOnlineStatus";
import { createUuid } from "@/shared/lib/createUuid";

const READING_MEMO_STORAGE_KEY = "practiceReadingMemos";

// 저장된 값의 모양을 검사할 스키마. localStorage 값이 이 모양이 아니면 훅이 initialMemos로 시작한다.
const readingMemoSchema = z.array(z.object({
  memoId: z.string(),
  title: z.string(),
  done: z.boolean(),
}));
type ReadingMemo = z.infer<typeof readingMemoSchema>[number];

const initialMemos: ReadingMemo[] = [
  { memoId: "memo-1", title: "React 공식 문서 — Reusing Logic with Custom Hooks", done: false },
  { memoId: "memo-2", title: "useSyncExternalStore 사용 사례 정리", done: true },
];

export const CustomHooksPracticePage = () => {
  // ↓ 이 한 줄이 "State 만들기 + localStorage 읽기·쓰기 + 저장값 검증"을 전부 해 준다.
  const [memos, setMemos] = useLocalStorageState(READING_MEMO_STORAGE_KEY, initialMemos, readingMemoSchema);
  const [newTitle, setNewTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  // keyword는 글자마다 바뀌고, debouncedKeyword는 0.3초 동안 입력이 멈춰야 바뀐다.
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const isOnline = useOnlineStatus();

  // 거른 목록은 State로 따로 두지 않고 렌더링할 때 계산한다(원본 memos와 어긋날 일이 없다).
  const normalizedKeyword = debouncedKeyword.trim().toLowerCase();
  const visibleMemos = normalizedKeyword
    ? memos.filter((memo) => memo.title.toLowerCase().includes(normalizedKeyword))
    : memos;

  const addMemo = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    // 불변성: 기존 배열을 바꾸지 않고 새 배열을 만든다. 훅이 State라서 규칙은 useState와 같다.
    setMemos((currentMemos) => [...currentMemos, { memoId: createUuid(), title: newTitle.trim(), done: false }]);
    setNewTitle("");
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="custom-hooks">커스텀 훅으로 반복 로직 분리하기</LearningGuideTitle>
          <p>저장·디바운스·외부 값 구독을 훅으로 옮겨, 페이지에는 화면 그리기만 남깁니다.</p>
        </div>
        <span className={`practice-status-chip${isOnline ? "" : " practice-status-chip-off"}`} role="status">
          {isOnline ? "온라인" : "오프라인 — 저장은 이 브라우저에만 됩니다"}
        </span>
      </div>

      <div className="split-practice-layout">
        <form className="practice-card" onSubmit={addMemo}>
          <h2>읽을거리 추가</h2>
          <label>제목<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={100} /></label>
          <button type="submit" disabled={!newTitle.trim()}>추가</button>
          <label>검색<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="입력이 멈추면 거릅니다" /></label>
          <small aria-live="polite">실제로 거른 검색어: {debouncedKeyword ? `"${debouncedKeyword}"` : "(없음)"}</small>
        </form>

        <article className="practice-card">
          <h2>메모 ({visibleMemos.length}/{memos.length})</h2>
          {visibleMemos.length === 0 ? <p>조건에 맞는 메모가 없습니다.</p> : (
            <ul className="practice-check-list" aria-label="읽을거리 목록">
              {visibleMemos.map((memo) => (
                <li key={memo.memoId}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={memo.done}
                      // 완료 표시 바꾸기: map으로 새 배열을 만들고, 해당 메모만 펼침 연산자로 새 객체를 만든다(원본 수정 금지).
                      onChange={() => setMemos((currentMemos) => currentMemos.map((currentMemo) => currentMemo.memoId === memo.memoId ? { ...currentMemo, done: !currentMemo.done } : currentMemo))}
                    />
                    <span className={memo.done ? "practice-done-text" : undefined}>{memo.title}</span>
                  </label>
                  <button type="button" className="ghost-button" aria-label={`${memo.title} 삭제`} onClick={() => setMemos((currentMemos) => currentMemos.filter((currentMemo) => currentMemo.memoId !== memo.memoId))}>삭제</button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
};
