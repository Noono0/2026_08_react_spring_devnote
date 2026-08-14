import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";
import { AuthenticationControls } from "@/features/auth/components/AuthenticationControls";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { DataSourceToggle } from "@/features/development/components/DataSourceToggle";

interface NavigationItem {
  label: string;
  description: string;
  route?: string;
  symbol: string;
  matchChildren?: boolean;
}

interface NavigationGroup {
  id: string;
  title: string;
  symbol: string;
  collapsible: boolean;
  items: NavigationItem[];
}

const portfolioNavigationGroup: NavigationGroup = {
  id: "portfolio",
  title: "홈과 기록",
  symbol: "PF",
  collapsible: false,
  items: [
    { label: "홈", description: "소개·연락처·Git·경력 CRUD · 섹션별 공개 설정", route: "/", symbol: "HM" },
    { label: "나의 업무 History", description: "트러블슈팅·개발 내용 기록", route: "/history", symbol: "HI", matchChildren: true },
  ],
};

const reactNavigationGroup: NavigationGroup = {
  id: "react",
  title: "React 연습",
  symbol: "RE",
  collapsible: true,
  items: [
    { label: "전체 로드맵", description: "왕초보부터 고급까지 학습 순서", route: "/react", symbol: "00" },
    { label: "왕초보", description: "컴포넌트·State·이벤트", route: "/react/level/beginner", symbol: "01" },
    { label: "초급", description: "폼·Reducer·로컬 CRUD", route: "/react/level/basic", symbol: "02" },
    { label: "중급", description: "Effect·게시판·비동기", route: "/react/level/intermediate", symbol: "03" },
    { label: "고급", description: "권한·트리·실제 백엔드", route: "/react/level/advanced", symbol: "04" },
  ],
};

const utilityNavigationGroup: NavigationGroup = {
  id: "utilities",
  title: "각종 유틸리티 게시판",
  symbol: "UT",
  collapsible: true,
  items: [
    { label: "유틸리티 홈", description: "개발 도구 전체 보기", route: "/utilities", symbol: "UT" },
    { label: "API Workspace", description: "요청·Collection·Runner", route: "/utilities/api-workspace", symbol: "API" },
    { label: "OpenAPI Studio", description: "API 문서·Collection 가져오기", route: "/utilities/api-workspace/openapi", symbol: "OAS" },
    { label: "WebSocket · SSE", description: "실시간 연결·메시지 로그", route: "/utilities/api-workspace/realtime", symbol: "WS" },
    { label: "Mock API", description: "지연·오류·순차 응답", route: "/utilities/api-workspace/mock", symbol: "MK" },
    { label: "Regex Tester", description: "정규식 검색·치환", route: "/utilities/regex", symbol: ".*" },
    { label: "Code Formatter", description: "HTML·JS·CSS·SQL 정리", route: "/utilities/formatter", symbol: "{}" },
    { label: "Data Converter", description: "JSON·YAML·XML 변환", route: "/utilities/converter", symbol: "CV" },
    { label: "JSON ↔ CSV", description: "JSON과 CSV 상호 변환", route: "/utilities/json-csv", symbol: "⇄" },
    { label: "Code Diff", description: "두 코드 차이 비교", route: "/utilities/diff", symbol: "±" },
    { label: "JWT Decoder", description: "JWT Header·Payload 확인", route: "/utilities/jwt", symbol: "JWT" },
    { label: "Markdown Editor", description: "마크다운 작성·미리보기", route: "/utilities/markdown", symbol: "M↓" },
    { label: "Test Data Generator", description: "테스트용 데이터 생성", route: "/utilities/test-data", symbol: "TG" },
    { label: "Developer Snippet", description: "회원별 코드 조각 CRUD", route: "/utilities/snippets", symbol: "</>" },
    { label: "Cron Generator", description: "Cron 표현식 만들기", route: "/utilities/cron", symbol: "◷" },
    { label: "Quick Tools", description: "문자열·케이스 빠른 변환", route: "/utilities/tools", symbol: "Aa" },
    { label: "투표", description: "토픽 생성·참여·결과", route: "/utilities/polls", symbol: "%" },
    { label: "JSONPath Explorer", description: "JSON 경로 검색·추출", route: "/utilities/jsonpath", symbol: "JP" },
    { label: "SQL Schema · ERD", description: "DDL 테이블 관계 시각화", route: "/utilities/sql-erd", symbol: "DB" },
    { label: "Log Analyzer", description: "Exception·Root Cause 분석", route: "/utilities/log-analyzer", symbol: "LOG" },
    { label: "CORS Inspector", description: "CORS·보안 Header 진단", route: "/utilities/cors-inspector", symbol: "CO" },
    { label: "Dependency Analyzer", description: "NPM·Gradle 의존성 분석", route: "/utilities/dependencies", symbol: "DP" },
  ],
};

const administratorNavigationGroup: NavigationGroup = {
  id: "admin",
  title: "관리자",
  symbol: "AD",
  collapsible: true,
  items: [
    { label: "관리자 홈", description: "관리 기능 바로가기", route: "/admin", symbol: "AD" },
    { label: "회원관리", description: "회원 상태·등급·역할", route: "/admin/members", symbol: "MB" },
    { label: "등급관리", description: "회원 등급 기준", route: "/admin/grades", symbol: "GR" },
    { label: "권한관리", description: "역할별 기능 권한", route: "/admin/permissions", symbol: "PM" },
    { label: "방문통계", description: "일간·월간 방문 현황", route: "/admin/analytics", symbol: "AN" },
  ],
};

const isNavigationItemActive = (pathname: string, navigationItem: NavigationItem): boolean => {
  if (!navigationItem.route) return false;
  if (pathname === navigationItem.route) return true;
  return Boolean(navigationItem.matchChildren && pathname.startsWith(`${navigationItem.route}/`));
};

const getInitiallyExpandedGroups = (pathname: string): Set<string> => {
  const expandedGroups = new Set<string>();
  if (pathname.startsWith("/react")) expandedGroups.add(reactNavigationGroup.id);
  if (pathname.startsWith("/utilities")) expandedGroups.add(utilityNavigationGroup.id);
  if (pathname.startsWith("/admin")) expandedGroups.add(administratorNavigationGroup.id);
  return expandedGroups;
};

export const ApplicationSidebar = () => {
  const location = useLocation();
  const sessionQuery = useAuthSessionQuery();
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => getInitiallyExpandedGroups(location.pathname));
  const {
    applicationTheme,
    isSidebarCollapsed,
    isMobileSidebarOpen,
    toggleApplicationTheme,
    toggleSidebarCollapsed,
    closeMobileSidebar,
  } = useApplicationUiStore();
  const navigationGroups = [portfolioNavigationGroup, reactNavigationGroup, utilityNavigationGroup];
  if (sessionQuery.data?.administrator) navigationGroups.push(administratorNavigationGroup);

  const sidebarClassName = [
    "application-sidebar",
    isSidebarCollapsed ? "application-sidebar-collapsed" : "",
    isMobileSidebarOpen ? "application-sidebar-mobile-open" : "",
  ].filter(Boolean).join(" ");

  const toggleNavigationGroup = (groupId: string): void => {
    setExpandedGroupIds((currentGroupIds) => {
      const nextGroupIds = new Set(currentGroupIds);
      if (nextGroupIds.has(groupId)) nextGroupIds.delete(groupId);
      else nextGroupIds.add(groupId);
      return nextGroupIds;
    });
  };

  const renderNavigationItems = (navigationGroup: NavigationGroup) => navigationGroup.items.map((navigationItem) => {
    const navigationContent = <><span className="sidebar-navigation-symbol" aria-hidden="true">{navigationItem.symbol}</span><span className="sidebar-expandable-content sidebar-navigation-copy"><strong>{navigationItem.label}</strong><small>{navigationItem.description}</small></span></>;
    if (!navigationItem.route) {
      return <div className="sidebar-navigation-link sidebar-navigation-link-disabled" aria-disabled="true" key={navigationItem.label} title={isSidebarCollapsed ? navigationItem.label : undefined}>{navigationContent}</div>;
    }
    const active = isNavigationItemActive(location.pathname, navigationItem);
    return (
      <Link className={`sidebar-navigation-link${active ? " active" : ""}`} key={navigationItem.route} to={navigationItem.route} onClick={closeMobileSidebar} title={isSidebarCollapsed ? navigationItem.label : undefined} aria-current={active ? "page" : undefined}>
        {navigationContent}
      </Link>
    );
  });

  return (
    <>
      <aside className={sidebarClassName} aria-label="전체 사이트 사이드 메뉴">
        <div className="sidebar-brand-row">
          <Link className="sidebar-brand" to="/" onClick={closeMobileSidebar}>
            <span className="sidebar-brand-mark">DN</span>
            <span className="sidebar-expandable-content"><strong>DevNote Lab</strong><small>Portfolio · React · Utility</small></span>
          </Link>
          <button className="sidebar-collapse-button desktop-only-button" type="button" onClick={toggleSidebarCollapsed} aria-label={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"} title={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}>{isSidebarCollapsed ? ">" : "<"}</button>
        </div>

        <nav className="sidebar-navigation" aria-label="전체 사이트 메뉴">
          {navigationGroups.map((navigationGroup) => (
            <section className="sidebar-navigation-group" key={navigationGroup.title}>
              {navigationGroup.collapsible ? (() => {
                const expanded = expandedGroupIds.has(navigationGroup.id);
                const submenuId = `sidebar-submenu-${navigationGroup.id}`;
                return <><button type="button" className="sidebar-group-toggle" aria-expanded={expanded} aria-controls={submenuId} aria-label={`${navigationGroup.title} 메뉴 ${expanded ? "접기" : "펼치기"}`} onClick={() => toggleNavigationGroup(navigationGroup.id)}><span className="sidebar-navigation-symbol" aria-hidden="true">{navigationGroup.symbol}</span><span className="sidebar-expandable-content sidebar-group-toggle-copy"><strong>{navigationGroup.title}</strong><span className="sidebar-group-arrow" aria-hidden="true">{expanded ? "▴" : "▾"}</span></span></button>{expanded ? <div className="sidebar-navigation-submenu" id={submenuId}>{renderNavigationItems(navigationGroup)}</div> : null}</>;
              })() : <><h2 className="sidebar-group-title sidebar-expandable-content">{navigationGroup.title}</h2>{renderNavigationItems(navigationGroup)}</>}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer sidebar-expandable-content">
          <div className="sidebar-account-panel"><AuthenticationControls /></div>
          <button type="button" className="sidebar-theme-button" onClick={toggleApplicationTheme} aria-label={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}><span>{applicationTheme === "dark" ? "☀" : "☾"}</span>{applicationTheme === "dark" ? "라이트 모드" : "다크 모드"}</button>
          {location.pathname.startsWith("/react") ? <DataSourceToggle compact /> : null}
        </div>
      </aside>

      {isMobileSidebarOpen ? <button className="mobile-sidebar-backdrop" type="button" onClick={closeMobileSidebar} aria-label="모바일 사이드바 닫기" /> : null}
    </>
  );
};
