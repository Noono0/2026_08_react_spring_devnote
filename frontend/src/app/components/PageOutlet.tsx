import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageErrorBoundary } from "@/app/components/PageErrorBoundary";

/**
 * 메뉴와 레이아웃을 유지하면서 이동한 페이지의 코드를 불러옵니다.
 *
 * 감싸는 순서: PageErrorBoundary(오류) → Suspense(로딩) → Outlet(페이지)
 *   Suspense보다 바깥에 두어야 lazy 페이지 파일을 내려받지 못한 오류까지 잡습니다.
 *   레이아웃 안쪽에 두었으므로 오류가 나도 사이드바·메뉴는 그대로 남습니다.
 */
export const PageOutlet = () => {
  const location = useLocation();
  return (
    <PageErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<div className="portfolio-state-panel" role="status">화면을 불러오는 중입니다.</div>}>
        <Outlet />
      </Suspense>
    </PageErrorBoundary>
  );
};
