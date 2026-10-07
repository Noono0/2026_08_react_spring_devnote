/**
 * ============================================================================
 * PageErrorBoundary.tsx — 페이지 하나가 터져도 앱 전체가 흰 화면이 되지 않게 막는 안전망
 * ============================================================================
 *
 * [Error Boundary란?]
 *   자식 컴포넌트가 "그리는 도중(render)" 던진 오류를 잡아서
 *   대신 보여 줄 화면(fallback)을 그리는 컴포넌트다.
 *   이게 없으면 React는 오류가 난 트리 전체를 지워 버린다. → 앱 전체가 흰 화면.
 *
 * [왜 class 컴포넌트인가?]
 *   React 19에도 Error Boundary를 만드는 훅은 없다.
 *   getDerivedStateFromError / componentDidCatch 두 메서드는 class에서만 쓸 수 있다.
 *   그래서 이 프로젝트에서 유일하게 class 컴포넌트로 만들었다.
 *
 * [잡지 못하는 오류]
 *   ❌ 버튼 onClick 안에서 난 오류, setTimeout·fetch 같은 비동기 오류
 *      → 이런 건 try/catch나 TanStack Query의 error 상태로 처리한다.
 *   ✓ 렌더링 중 오류, React.lazy 페이지 파일을 내려받지 못한 오류
 *
 * [새 배포 직후의 흰 화면]
 *   페이지 코드는 React.lazy로 "필요할 때" 내려받는다(파일 이름에 해시가 붙는다).
 *   새 버전이 배포되면 예전 파일이 서버에서 사라지므로,
 *   배포 전에 열어 둔 탭에서 메뉴를 누르면 옛 파일을 못 찾아 오류가 난다.
 *   이 경우에는 "새로고침하면 해결된다"고 따로 안내한다.
 *
 * [다른 메뉴로 이동하면 다시 정상 화면]
 *   resetKey(현재 주소)가 바뀌면 오류 상태를 지운다.
 *   이걸 빼먹으면 한 번 오류가 난 뒤에는 어느 메뉴를 눌러도 계속 오류 화면만 보인다.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { applicationLogger } from "@/shared/logging/applicationLogger";

interface PageErrorBoundaryProps {
  /** 이 값이 바뀌면 오류 상태를 초기화한다. 보통 현재 주소(pathname)를 넘긴다. */
  resetKey: string;
  children: ReactNode;
}

interface PageErrorBoundaryState {
  error: Error | null;
}

/**
 * 브라우저마다 "동적 import 파일을 못 받았다"는 문구가 다르다.
 *   Chrome  : Failed to fetch dynamically imported module
 *   Safari  : Importing a module script failed
 *   Firefox : error loading dynamically imported module
 */
export const isChunkLoadError = (error: Error): boolean =>
  /dynamically imported module|Importing a module script failed/i.test(error.message);

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null };

  // 렌더링 도중 오류가 나면 React가 호출한다. 반환한 값이 새 state가 된다.
  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error };
  }

  // 화면을 바꾸는 것과 별개로 "무슨 일이 있었는지" 기록하는 곳이다.
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    applicationLogger.error("[PageErrorBoundary] 화면을 그리지 못했습니다.", {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  // 주소가 바뀌었는데 아직 오류 화면이면 초기화해서 새 페이지를 그리게 한다.
  componentDidUpdate(previousProps: PageErrorBoundaryProps): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkLoadFailed = isChunkLoadError(error);
    return (
      <section className="portfolio-state-panel" role="alert">
        <h2>{chunkLoadFailed ? "새 버전이 배포되었습니다" : "화면을 표시하지 못했습니다"}</h2>
        <p>
          {chunkLoadFailed
            ? "이 탭이 열려 있는 동안 사이트가 업데이트되어 화면 파일을 찾지 못했습니다. 새로고침하면 최신 화면이 열립니다."
            : "일시적인 오류일 수 있습니다. 새로고침하거나 다른 메뉴로 이동해 주세요."}
        </p>
        <div className="button-row">
          <button type="button" onClick={() => window.location.reload()}>새로고침</button>
          {/* 단순 렌더링 오류라면 새로고침 없이 같은 화면을 다시 그려 볼 수 있다. */}
          {chunkLoadFailed ? null : (
            <button type="button" className="ghost-button" onClick={() => this.setState({ error: null })}>다시 시도</button>
          )}
        </div>
      </section>
    );
  }
}
