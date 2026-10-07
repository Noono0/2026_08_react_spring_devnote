/**
 * PortfolioLayout.tsx — 공개 포트폴리오 영역(홈·업무 History·유틸리티·관리자)의 공통 틀
 *
 * 왼쪽 사이드바 + 본문(PageOutlet) + 바닥글. 모바일에서는 상단 바의 ☰ 버튼으로 사이드바를 연다.
 * PageOutlet: 하위 화면을 그리는 자리. 오류 경계와 Suspense(지연 로딩 화면)를 함께 감싼다.
 */
import { Link, useLocation } from "react-router-dom";
import { PageOutlet } from "@/app/components/PageOutlet";
import { ApplicationSidebar } from "@/app/components/ApplicationSidebar";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

/** 모바일 상단 바에 보여 줄 현재 영역 이름(주소의 앞부분으로 판단). */
const getPageTitle = (pathname: string): string => {
  if (pathname.startsWith("/history")) return "나의 업무 History";
  if (pathname.startsWith("/utilities")) return "각종 유틸리티 게시판";
  if (pathname.startsWith("/admin")) return "관리자";
  return "홈";
};

export const PortfolioLayout = () => {
  const location = useLocation();
  const isUtilityPage = location.pathname.startsWith("/utilities");
  // 사이드바 접힘 상태는 Zustand 전역 저장소에서 필요한 값만 골라 구독한다.
  const isSidebarCollapsed = useApplicationUiStore((state) => state.isSidebarCollapsed);
  const openMobileSidebar = useApplicationUiStore((state) => state.openMobileSidebar);

  return (
    <div className={`portfolio-shell application-shell${isSidebarCollapsed ? " application-shell-sidebar-collapsed" : ""}`}>
      <ApplicationSidebar />
      <div className="application-content-shell">
        <header className="portfolio-mobile-top-bar">
          <button className="top-bar-icon-button" type="button" onClick={openMobileSidebar} aria-label="사이드바 메뉴 열기">☰</button>
          <Link to="/"><span>DN</span><strong>{getPageTitle(location.pathname)}</strong></Link>
        </header>
        {/* 유틸리티 화면은 표·편집기가 넓어 본문 폭을 넓힌다. */}
        <main className={`portfolio-main${isUtilityPage ? " portfolio-main-wide" : ""}`}><PageOutlet /></main>
        <footer className="portfolio-footer"><p>React와 Spring Boot로 직접 관리하는 포트폴리오입니다.</p></footer>
      </div>
    </div>
  );
};
