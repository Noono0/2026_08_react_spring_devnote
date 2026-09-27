import { Suspense } from "react";
import { Outlet } from "react-router-dom";

/** 메뉴와 레이아웃을 유지하면서 이동한 페이지의 코드를 불러옵니다. */
export const PageOutlet = () => (
  <Suspense fallback={<div className="portfolio-state-panel" role="status">화면을 불러오는 중입니다.</div>}>
    <Outlet />
  </Suspense>
);
