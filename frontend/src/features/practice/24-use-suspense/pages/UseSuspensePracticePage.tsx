/**
 * ============================================================================
 * UseSuspensePracticePage.tsx — 【고급】 React 19 use()와 Suspense·Error Boundary
 * ============================================================================
 *
 * [지금까지의 방식]
 *   const query = useQuery(...);
 *   if (query.isPending) return <로딩/>;
 *   if (query.isError) return <오류/>;
 *   return <목록 data={query.data}/>;
 *   → 컴포넌트마다 "로딩이면? 오류면?"을 직접 검사했다.
 *
 * [use() + Suspense 방식]
 *   const notices = use(noticePromise);   ← 끝날 때까지 이 컴포넌트는 "잠시 멈춤"
 *   return <목록 data={notices}/>;         ← 여기서는 항상 데이터가 있다고 가정해도 된다
 *
 *   로딩 화면 → 바깥의 <Suspense fallback={...}>가 대신 보여 준다.
 *   오류 화면 → 바깥의 Error Boundary가 대신 보여 준다.
 *   즉 "기다리기·실패"를 부모의 경계(boundary)에 맡기고, 컴포넌트는 성공한 경우만 그린다.
 *
 * [확인할 것]
 *   1. "실패 연습"을 켜고 다시 불러오면 Error Boundary 화면이 나오고, "다시 시도"로 회복한다.
 *   2. Promise를 렌더링마다 새로 만들지 않도록 localNoticeApi.ts에서 보관(캐시)한다.
 *   3. 이 앱의 페이지 전체도 같은 구조다: PageOutlet = PageErrorBoundary(오류) + Suspense(로딩).
 */

import { Component, Suspense, use, useState, type ReactNode } from "react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { getNoticePromise, type PracticeNotice } from "@/features/practice/24-use-suspense/api/localNoticeApi";

/** use()로 Promise의 결과를 꺼낸다. 아직 안 끝났으면 가장 가까운 Suspense가 fallback을 보여 준다. */
const NoticeList = ({ noticePromise }: { noticePromise: Promise<PracticeNotice[]> }) => {
  // Promise가 아직 진행 중이면 React가 이 컴포넌트를 "멈추고" Suspense fallback을 보여 준다.
  // 실패(reject)하면 가장 가까운 Error Boundary로 오류가 전달된다.
  const notices = use(noticePromise);
  return (
    <ul className="practice-check-list" aria-label="공지 목록">
      {notices.map((notice) => <li key={notice.noticeId}>{notice.title}</li>)}
    </ul>
  );
};

interface NoticeErrorBoundaryProperties {
  children: ReactNode;
  onRetry: () => void;
}

/**
 * 이 단계 전용 오류 경계. 앱 공용 PageErrorBoundary는 "주소가 바뀌면 초기화"하지만,
 * 여기서는 "다시 시도" 버튼으로 새 요청을 만들고 초기화해야 해서 onRetry를 받는다.
 */
// Error Boundary는 아직 함수형 훅으로 만들 수 없어 클래스 컴포넌트로 작성한다.
class NoticeErrorBoundary extends Component<NoticeErrorBoundaryProperties, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  // 자식 렌더링 중 오류가 나면 React가 이 함수를 불러 다음 state를 받는다 → 오류 화면으로 바뀐다.
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  retry = (): void => {
    // 순서가 중요하다: 새 Promise를 만들게 한 뒤 오류 상태를 지워야, 다시 그릴 때 실패한 옛 Promise를 쓰지 않는다.
    this.props.onRetry();
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="state-panel error-state" role="alert">
        <p>{this.state.error.message}</p>
        <button type="button" onClick={this.retry}>다시 시도</button>
      </div>
    );
  }
}

export const UseSuspensePracticePage = () => {
  const [attempt, setAttempt] = useState(1);
  const [shouldFail, setShouldFail] = useState(false);
  // 같은 attempt·shouldFail이면 보관해 둔 같은 Promise를 받는다(렌더링마다 새 요청 X).
  const noticePromise = getNoticePromise(attempt, shouldFail);

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="use-suspense">React 19 use()와 Suspense</LearningGuideTitle>
          <p>use()로 Promise를 읽고, 로딩은 Suspense, 실패는 Error Boundary에 맡깁니다.</p>
        </div>
      </div>

      <div className="practice-card">
        <div className="button-row">
          {/* 조건이 바뀌면 getNoticePromise가 새 key로 새 요청을 만들고, 그동안 Suspense가 로딩 문구를 보여 준다. */}
          <label className="checkbox-label"><input type="checkbox" checked={shouldFail} onChange={(event) => setShouldFail(event.target.checked)} />실패 연습</label>
          <button type="button" onClick={() => setAttempt((currentAttempt) => currentAttempt + 1)}>다시 불러오기</button>
          <small>요청 번호 {attempt}</small>
        </div>
        {/* 바깥: 오류 경계 / 안쪽: 로딩 경계. Suspense가 안쪽이어야 로딩 중에도 오류 경계는 유지된다. */}
        <NoticeErrorBoundary onRetry={() => { setShouldFail(false); setAttempt((currentAttempt) => currentAttempt + 1); }}>
          <Suspense fallback={<p role="status">공지를 불러오는 중입니다...</p>}>
            <NoticeList noticePromise={noticePromise} />
          </Suspense>
        </NoticeErrorBoundary>
      </div>
    </section>
  );
};
