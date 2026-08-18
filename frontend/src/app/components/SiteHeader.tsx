/**
 * ============================================================================
 * SiteHeader.tsx — 포트폴리오 영역의 상단 가로 메뉴 (헤더)
 * ============================================================================
 *
 * 학습 영역은 왼쪽 사이드바(ApplicationSidebar)를 쓰고,
 * 포트폴리오 영역은 이 가로형 헤더를 쓴다.
 *
 * [사이드바와 다른 점]
 *   사이드바는 메뉴를 배열 데이터로 만들고 .map()으로 그렸지만,
 *   여기는 <Link>를 직접 하나씩 나열했다.
 *   메뉴 수가 적고 구조가 제각각일 때는 이렇게 직접 쓰는 게 더 읽기 쉽다.
 *   "무조건 데이터로 빼는 게 정답"은 아니다. 상황에 맞게 고르면 된다.
 *
 * [드롭다운의 원리]
 *   이 헤더의 하위 메뉴는 JavaScript State를 전혀 쓰지 않는다.
 *   .site-submenu를 평소엔 숨겨 뒀다가 CSS의 :hover로 보여주는 방식이다.
 *   State가 필요 없으니 코드가 훨씬 간단하다.
 *   (다만 터치 기기에서는 hover가 없어서, 모바일은 사이드바 쪽을 쓴다)
 */

import { Link } from "react-router-dom";
import { AuthenticationControls } from "@/features/auth/components/AuthenticationControls";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

export const SiteHeader = () => {
  // 로그인 세션 정보. 관리자 메뉴를 보여줄지 판단하는 데 쓴다.
  const sessionQuery = useAuthSessionQuery();

  // ★ 스토어에서 값을 하나씩 따로 꺼냈다.
  //   const { a, b } = useStore() 처럼 통째로 가져오는 것과 결과는 같지만,
  //   이렇게 selector로 하나씩 꺼내면 그 값이 바뀔 때만 다시 그려져서 더 효율적이다.
  //   참고: toggleApplicationTheme 같은 "함수"는 Zustand에서 절대 안 바뀌므로
  //         이 줄 때문에 다시 그려질 일은 없다.
  const applicationTheme = useApplicationUiStore((state) => state.applicationTheme);
  const toggleApplicationTheme = useApplicationUiStore((state) => state.toggleApplicationTheme);

  return (
    <header className="site-header">
      <Link className="portfolio-brand" to="/"><span>DN</span><strong>DevNote</strong></Link>
      {/* <nav>: "여기는 메뉴 모음"이라는 뜻의 시맨틱 태그.
          페이지에 <nav>가 여러 개일 수 있으므로 aria-label로 구분해 준다. */}
      <nav aria-label="전체 메뉴">
        <Link to="/">홈</Link>
        {/* 드롭다운 한 세트의 구조:
              바깥 div(.site-menu-dropdown) = 마우스를 올릴 대상
                ├ <Link>            = 항상 보이는 대표 메뉴
                └ div(.site-submenu) = 평소엔 숨김, hover하면 나타나는 하위 메뉴 */}
        <div className="site-menu-dropdown"><Link to="/react">React 연습</Link><div className="site-submenu"><Link to="/react">전체 로드맵</Link><Link to="/react/level/beginner">왕초보</Link><Link to="/react/level/basic">초급</Link><Link to="/react/level/intermediate">중급</Link><Link to="/react/level/advanced">고급</Link></div></div>
        <Link to="/history">나의 업무 History</Link>
        <div className="site-menu-dropdown"><Link to="/utilities">개발 유틸리티</Link><div className="site-submenu utility-site-submenu"><Link to="/utilities/api-workspace">API Workspace</Link><Link to="/utilities/regex">Regex Tester</Link><Link to="/utilities/formatter">Code Formatter</Link><Link to="/utilities/converter">Data Converter</Link><Link to="/utilities/json-csv">JSON ↔ CSV</Link><Link to="/utilities/diff">Code Diff</Link><Link to="/utilities/jwt">JWT Decoder</Link><Link to="/utilities/markdown">Markdown Editor</Link><Link to="/utilities/test-data">Test Data</Link><Link to="/utilities/snippets">Developer Snippet</Link><Link to="/utilities/cron">Cron Generator</Link><Link to="/utilities/tools">Quick Tools</Link><Link to="/utilities/polls">투표</Link></div></div>
        {/* 관리자에게만 보이는 메뉴.
            sessionQuery.data는 로그인 정보를 아직 못 받았으면 undefined이므로
            `?.`(옵셔널 체이닝)로 안전하게 접근한다.
            ★ 다시 강조: 메뉴를 숨기는 건 편의일 뿐 보안이 아니다.
              실제 차단은 RoleProtectedRoute와 백엔드가 한다. */}
        {sessionQuery.data?.administrator ? <div className="site-menu-dropdown"><Link to="/admin">관리자</Link><div className="site-submenu"><Link to="/admin/members">회원관리</Link><Link to="/admin/grades">등급관리</Link><Link to="/admin/permissions">권한관리</Link><Link to="/admin/analytics">방문통계</Link></div></div> : null}
      </nav>
      <div className="site-header-actions"><AuthenticationControls /><button type="button" className="ghost-button" onClick={toggleApplicationTheme} aria-label={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}>{applicationTheme === "dark" ? "☀" : "☾"}</button></div>
    </header>
  );
};
