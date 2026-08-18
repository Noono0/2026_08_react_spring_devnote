/**
 * ============================================================================
 * ApplicationSidebar.tsx — 왼쪽 메뉴 사이드바
 * ============================================================================
 *
 * [이 파일에서 배울 핵심 개념]
 *   1. 데이터 주도 UI (data-driven UI)
 *      메뉴 20개를 <Link> 태그로 20번 복붙하지 않는다.
 *      대신 "메뉴 목록"을 배열 데이터로 만들어 두고 .map()으로 한 번에 그린다.
 *      → 메뉴를 추가할 때 배열에 한 줄만 넣으면 끝난다.
 *
 *   2. 상태를 어디에 둘지 판단하기
 *      - 접힌 메뉴 그룹 목록 → 이 컴포넌트만 씀 → useState (지역 상태)
 *      - 사이드바 접힘/테마  → 다른 컴포넌트도 씀 → Zustand (전역 상태)
 *
 *   3. Set 자료구조를 State로 쓰기 (불변성 지키기)
 *
 *   4. 권한에 따라 메뉴를 보여주거나 숨기기
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";
import { AuthenticationControls } from "@/features/auth/components/AuthenticationControls";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { DataSourceToggle } from "@/features/development/components/DataSourceToggle";

// ----------------------------------------------------------------------------
// 1. 메뉴 데이터의 "모양"을 먼저 정의한다 (타입)
// ----------------------------------------------------------------------------

/** 메뉴 한 줄(링크 하나)의 모양. */
interface NavigationItem {
  label: string;        // 화면에 보이는 메뉴 이름
  description: string;  // 메뉴 아래 작게 붙는 설명
  // 이름 뒤의 `?` = "있어도 되고 없어도 되는 값(optional)".
  // route가 없으면 = "아직 준비 중인 메뉴" → 클릭 안 되는 회색 항목으로 그린다.
  route?: string;
  symbol: string;       // 접혔을 때 보여줄 짧은 기호 (예: "HM", "01")
  // 하위 주소까지 현재 메뉴로 볼지 여부.
  // 예: "/history"에 true를 주면 "/history/3"에 있을 때도 이 메뉴가 활성 표시된다.
  matchChildren?: boolean;
}

/** 메뉴 묶음(그룹) 하나의 모양. */
interface NavigationGroup {
  id: string;                // 접기/펼치기 상태를 구분하는 고유 키
  title: string;             // 그룹 제목
  symbol: string;
  collapsible: boolean;      // true면 클릭해서 접었다 폈다 할 수 있는 그룹
  items: NavigationItem[];   // `[]`는 "이 타입의 배열"이라는 뜻
}

// ----------------------------------------------------------------------------
// 2. 실제 메뉴 데이터
// ----------------------------------------------------------------------------
// 컴포넌트 바깥에 둔 이유: 이 값들은 절대 변하지 않는 고정 데이터다.
// 컴포넌트 안에 두면 화면을 다시 그릴 때마다 똑같은 배열을 계속 새로 만들게 된다.

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
    { label: "Diagram Designer", description: "ERD·순서도 작성·저장·버전관리", route: "/utilities/diagrams", symbol: "ERD", matchChildren: true },
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

// ----------------------------------------------------------------------------
// 3. 계산만 하는 도우미 함수들 (순수 함수)
// ----------------------------------------------------------------------------

/**
 * 이 메뉴가 "지금 보고 있는 페이지"인지 판단한다.
 * 결과가 true면 메뉴에 하이라이트(active 클래스)를 입힌다.
 */
const isNavigationItemActive = (pathname: string, navigationItem: NavigationItem): boolean => {
  // 주소가 없는(준비 중인) 메뉴는 활성화될 수 없다.
  if (!navigationItem.route) return false;

  // 주소가 정확히 같으면 당연히 활성.
  if (pathname === navigationItem.route) return true;

  // matchChildren이 켜진 메뉴만 하위 주소도 활성으로 쳐 준다.
  //
  // ★ 왜 뒤에 슬래시(`/`)를 붙였을까?
  //   그냥 startsWith("/history")로 하면 "/historyXYZ" 같은 엉뚱한 주소도 걸린다.
  //   "/history/" 로 검사해야 진짜 하위 경로만 잡힌다.
  //
  // ★ Boolean(...)으로 감싼 이유
  //   matchChildren은 optional이라 값이 없으면 undefined다.
  //   `undefined && ...` 의 결과는 false가 아니라 undefined인데,
  //   이 함수는 boolean을 돌려주기로 약속했으므로 확실하게 true/false로 바꿔 준다.
  return Boolean(navigationItem.matchChildren && pathname.startsWith(`${navigationItem.route}/`));
};

/**
 * 페이지에 처음 들어왔을 때 어떤 메뉴 그룹을 펼쳐 둘지 정한다.
 *
 * 사용자가 "/utilities/regex"로 바로 들어왔는데 유틸리티 그룹이 접혀 있으면
 * "내가 지금 어디 있지?" 하고 헤매게 된다. 그래서 관련 그룹을 미리 펼쳐 준다.
 *
 * [Set이 뭔가요?]
 *   중복 없는 값들의 모음. 배열과 비슷하지만 두 가지가 다르다.
 *     - 같은 값을 두 번 넣어도 하나만 저장된다
 *     - `has(값)`으로 포함 여부를 아주 빠르게 확인할 수 있다
 *       (배열의 includes는 처음부터 하나씩 훑어야 해서 느리다)
 *   "펼쳐진 그룹 목록"처럼 중복이 있으면 안 되고 확인이 잦은 데이터에 딱 맞다.
 */
const getInitiallyExpandedGroups = (pathname: string): Set<string> => {
  // `new Set<string>()` = 문자열만 담는 빈 Set을 만든다.
  const expandedGroups = new Set<string>();
  if (pathname.startsWith("/react")) expandedGroups.add(reactNavigationGroup.id);
  if (pathname.startsWith("/utilities")) expandedGroups.add(utilityNavigationGroup.id);
  if (pathname.startsWith("/admin")) expandedGroups.add(administratorNavigationGroup.id);
  return expandedGroups;
};

// ----------------------------------------------------------------------------
// 4. 컴포넌트 본체
// ----------------------------------------------------------------------------

export const ApplicationSidebar = () => {
  const location = useLocation();

  // 로그인 정보를 서버에서 가져온다. 관리자 메뉴를 보여줄지 판단하는 데 쓴다.
  const sessionQuery = useAuthSessionQuery();

  // ★ useState에 "함수"를 넘긴 것에 주목! (lazy initializer / 게으른 초기화)
  //
  //   useState(getInitiallyExpandedGroups(location.pathname))  ← 이렇게 쓰면
  //     화면을 다시 그릴 때마다 함수가 매번 실행된다.
  //     (결과는 첫 번째 것만 쓰이고 나머지는 버려진다. 완전한 낭비다)
  //
  //   useState(() => getInitiallyExpandedGroups(...))          ← 이렇게 쓰면
  //     React가 "맨 처음 한 번만" 이 함수를 실행한다.
  //
  //   계산이 무겁거나 객체를 새로 만드는 초기값이면 이 방식을 쓰자.
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => getInitiallyExpandedGroups(location.pathname));
  const {
    applicationTheme,
    isSidebarCollapsed,
    isMobileSidebarOpen,
    toggleApplicationTheme,
    toggleSidebarCollapsed,
    closeMobileSidebar,
  } = useApplicationUiStore();

  // 누구나 볼 수 있는 그룹 3개를 먼저 담는다.
  // ★ 이 배열은 화면을 그릴 때마다 새로 만들어지는 "임시 변수"다.
  //   State가 아니므로 여기에 push해도 문제없다.
  //   (State 배열이었다면 push는 절대 금지! 새 배열을 만들어야 한다)
  const navigationGroups = [portfolioNavigationGroup, reactNavigationGroup, utilityNavigationGroup];

  // `?.` = 옵셔널 체이닝(optional chaining).
  //   sessionQuery.data는 로그인 정보를 아직 못 받았으면 undefined다.
  //   그냥 sessionQuery.data.administrator 라고 쓰면
  //   "undefined의 속성을 읽을 수 없다"는 에러로 앱이 죽는다.
  //   `?.`를 쓰면 앞이 undefined일 때 에러 대신 그냥 undefined를 돌려준다.
  //
  // ★ 중요: 이건 어디까지나 "화면 편의"일 뿐 보안 장치가 아니다.
  //   메뉴를 숨겨도 사용자가 주소를 직접 치고 들어올 수 있다.
  //   진짜 차단은 RoleProtectedRoute와 백엔드 서버가 담당한다.
  if (sessionQuery.data?.administrator) navigationGroups.push(administratorNavigationGroup);

  // 조건에 따라 CSS 클래스를 조합하는 흔한 패턴.
  //   1) 배열에 클래스들을 담는다 (해당 없으면 빈 문자열 "")
  //   2) .filter(Boolean) 으로 빈 문자열을 걸러낸다
  //      → Boolean("")은 false, Boolean("어떤글자")는 true라서
  //        내용 있는 것만 남는다. 짧게 쓰는 관용구다.
  //   3) .join(" ") 으로 공백을 끼워 하나의 문자열로 합친다
  //
  // 이렇게 안 하고 그냥 이어 붙이면 "a  b" 처럼 공백이 두 개 생기거나
  // 맨 끝에 공백이 남는 지저분한 결과가 나온다.
  const sidebarClassName = [
    "application-sidebar",
    isSidebarCollapsed ? "application-sidebar-collapsed" : "",
    isMobileSidebarOpen ? "application-sidebar-mobile-open" : "",
  ].filter(Boolean).join(" ");

  /**
   * 메뉴 그룹 하나를 접거나 편다. (이미 펼쳐져 있으면 접고, 접혀 있으면 편다)
   *
   * ★★ 이 함수가 이 파일에서 가장 중요한 학습 포인트다. 두 가지를 동시에 보여준다.
   *
   * (1) 함수형 업데이트 — setState에 값 대신 함수를 넘기기
   *     setExpandedGroupIds(새값)          ← 지금 화면에 있는 값을 보고 계산 (위험)
   *     setExpandedGroupIds(현재값 => 새값) ← React가 넘겨준 "진짜 최신값"으로 계산 (안전)
   *
   *     React는 상태 변경을 모아서 한꺼번에 처리한다.
   *     그래서 연속으로 두 번 호출하면 앞의 결과를 못 보고 계산해서 하나가 씹힌다.
   *     "이전 값을 기반으로 다음 값을 만들 때"는 무조건 함수형으로 쓰자.
   *
   * (2) 불변성(immutability) — 원본을 고치지 말고 복사본을 만들기
   *     ✗ 나쁜 예: expandedGroupIds.add(groupId); setExpandedGroupIds(expandedGroupIds);
   *       원본을 직접 고치면 React가 보기엔 "주소가 그대로인 같은 Set"이다.
   *       바뀐 걸 눈치채지 못해서 화면이 갱신되지 않는다.
   *     ✓ 좋은 예: new Set(원본)으로 복사본을 만들고, 복사본을 고쳐서 돌려준다.
   *       주소가 다른 새 Set이므로 React가 변화를 확실히 알아챈다.
   */
  const toggleNavigationGroup = (groupId: string): void => {
    setExpandedGroupIds((currentGroupIds) => {
      // 기존 Set의 내용을 복사한 새 Set을 만든다. (원본은 건드리지 않는다)
      const nextGroupIds = new Set(currentGroupIds);
      // 있으면 빼고(접기), 없으면 넣는다(펼치기).
      if (nextGroupIds.has(groupId)) nextGroupIds.delete(groupId);
      else nextGroupIds.add(groupId);
      // 반드시 "새 값"을 return 해야 한다. return을 빠뜨리면 상태가 undefined가 된다.
      return nextGroupIds;
    });
  };

  /**
   * 그룹 하나에 들어 있는 메뉴 항목들을 JSX 배열로 만들어 돌려준다.
   *
   * 컴포넌트로 따로 빼지 않고 함수로 둔 이유:
   * 이 컴포넌트 안의 값들(location, isSidebarCollapsed, closeMobileSidebar)을
   * 그대로 쓸 수 있어서 props로 일일이 넘겨줄 필요가 없기 때문이다.
   * 다만 규모가 더 커지면 별도 컴포넌트로 분리하는 게 낫다.
   */
  const renderNavigationItems = (navigationGroup: NavigationGroup) => navigationGroup.items.map((navigationItem) => {
    // JSX는 변수에 담아 뒀다가 나중에 꺼내 쓸 수 있다. (아래 두 갈래에서 재사용한다)
    //
    // `<>...</>` = Fragment(프래그먼트).
    //   JSX는 반드시 최상위 태그가 하나여야 하는데, 굳이 <div>로 감싸면
    //   쓸데없는 태그가 생겨 CSS 배치가 꼬인다. Fragment는 태그 없이 여러 개를 묶어 준다.
    //
    // aria-hidden="true" → 화면 낭독기가 이 부분을 건너뛴다.
    //   "HM", "01" 같은 기호는 소리로 들으면 의미가 없기 때문이다.
    //   대신 옆의 <strong>{label}</strong>이 진짜 의미를 전달한다.
    const navigationContent = <><span className="sidebar-navigation-symbol" aria-hidden="true">{navigationItem.symbol}</span><span className="sidebar-expandable-content sidebar-navigation-copy"><strong>{navigationItem.label}</strong><small>{navigationItem.description}</small></span></>;

    // 갈래 1) route가 없는 항목 = 아직 준비 중 → 클릭 안 되는 <div>로 그린다.
    //   <a href="">로 만들고 CSS로 막는 방법도 있지만, 그러면 키보드 Tab으로 여전히 선택된다.
    //   아예 링크가 아닌 태그로 만들고 aria-disabled로 상태를 알리는 게 정직한 방법이다.
    if (!navigationItem.route) {
      // key: 아래 .map()이 만드는 목록에서 각 항목을 구분하는 이름표.
      //   React는 이 key로 "무엇이 추가/삭제/이동됐는지" 판단한다.
      //   route가 없으니 label을 key로 쓴다.
      //   ★ key에 배열 인덱스(0,1,2...)를 쓰면 목록 순서가 바뀔 때 버그가 난다.
      //     되도록 그 항목만의 고유한 값을 쓰자.
      //
      // title={조건 ? 값 : undefined}
      //   undefined를 주면 React가 그 속성 자체를 아예 안 붙인다.
      //   사이드바가 접혀서 글자가 안 보일 때만 말풍선을 띄우려는 것이다.
      return <div className="sidebar-navigation-link sidebar-navigation-link-disabled" aria-disabled="true" key={navigationItem.label} title={isSidebarCollapsed ? navigationItem.label : undefined}>{navigationContent}</div>;
    }

    // 갈래 2) 정상적인 링크 항목
    const active = isNavigationItemActive(location.pathname, navigationItem);
    return (
      // ★ <Link>를 쓰고 <a>를 쓰지 않는 이유
      //   <a href="/react">는 브라우저가 서버에 새 페이지를 요청해서 화면이 새로고침된다.
      //   그러면 React 앱이 처음부터 다시 켜지고 State가 전부 날아간다.
      //   <Link to="/react">는 새로고침 없이 주소만 바꾸고 필요한 부분만 다시 그린다.
      //   앱 내부 이동에는 항상 <Link>를, 외부 사이트로 나갈 때만 <a>를 쓴다.
      //
      // onClick={closeMobileSidebar}
      //   모바일에서는 메뉴를 누르면 사이드바가 저절로 닫혀야 자연스럽다.
      //   PC에서는 이미 닫혀 있는 상태라 호출해도 아무 일도 안 일어난다.
      //
      // aria-current={active ? "page" : undefined}
      //   "이게 지금 보고 있는 페이지"임을 화면 낭독기에 알린다.
      //   색깔(active 클래스)만으로는 시각장애 사용자가 알 수 없다.
      <Link className={`sidebar-navigation-link${active ? " active" : ""}`} key={navigationItem.route} to={navigationItem.route} onClick={closeMobileSidebar} title={isSidebarCollapsed ? navigationItem.label : undefined} aria-current={active ? "page" : undefined}>
        {navigationContent}
      </Link>
    );
  });

  return (
    // 최상위를 Fragment로 감쌌다.
    // 사이드바(<aside>)와 모바일 배경막이 서로 형제 관계여야
    // CSS의 position: fixed 배치가 꼬이지 않기 때문이다.
    <>
      {/* <aside>: "본문에서 살짝 벗어난 보조 영역"을 뜻하는 시맨틱 태그.
          그냥 <div>를 써도 화면은 똑같지만, 검색엔진과 화면 낭독기가
          "여기는 메뉴구나"라고 이해하려면 의미 있는 태그를 써야 한다. */}
      <aside className={sidebarClassName} aria-label="전체 사이트 사이드 메뉴">
        <div className="sidebar-brand-row">
          <Link className="sidebar-brand" to="/" onClick={closeMobileSidebar}>
            <span className="sidebar-brand-mark">DN</span>
            <span className="sidebar-expandable-content"><strong>DevNote Lab</strong><small>Portfolio · React · Utility</small></span>
          </Link>
          <button className="sidebar-collapse-button desktop-only-button" type="button" onClick={toggleSidebarCollapsed} aria-label={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"} title={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}>{isSidebarCollapsed ? ">" : "<"}</button>
        </div>

        <nav className="sidebar-navigation" aria-label="전체 사이트 메뉴">
          {/* ★ 데이터 주도 UI의 핵심.
              메뉴 그룹 배열을 .map()으로 돌면서 JSX를 만들어 낸다.
              메뉴를 추가하려면 위쪽 배열에 한 줄 넣기만 하면 되고,
              이 렌더링 코드는 손댈 필요가 없다.

              .map()은 배열의 각 원소를 다른 값으로 바꿔 새 배열을 만드는 함수다.
              React는 JSX 배열을 받으면 그 안의 것들을 차례대로 화면에 그려 준다. */}
          {navigationGroups.map((navigationGroup) => (
            <section className="sidebar-navigation-group" key={navigationGroup.title}>
              {/* 접을 수 있는 그룹이면 토글 버튼 방식, 아니면 그냥 제목 + 목록. */}
              {navigationGroup.collapsible ? (() => {
                // ★ (() => { ... })() 는 IIFE(즉시 실행 함수)다.
                //   JSX의 `{}` 안에는 if문 같은 "문장"을 쓸 수 없고 "값"만 쓸 수 있다.
                //   그런데 여기서는 중간 변수 두 개를 계산하고 싶다.
                //   그래서 함수를 만들어서 바로 실행하고, 그 반환값(JSX)을 쓴다.
                //   솔직히 읽기 어려운 편이라, 실무에서는 이 부분을
                //   별도 컴포넌트(<SidebarGroup group={...} />)로 빼는 걸 권한다.
                const expanded = expandedGroupIds.has(navigationGroup.id);
                // 버튼과 하위 메뉴를 aria-controls로 연결하기 위한 고유 id.
                const submenuId = `sidebar-submenu-${navigationGroup.id}`;
                // 아래 한 줄은 길지만 구조는 단순하다. 두 덩어리로 나눠 보면 된다.
                //
                //   [1] <button ...>  : 그룹 제목 + 화살표(▴/▾). 누르면 접기/펼치기.
                //   [2] {expanded ? <div>메뉴들</div> : null}
                //                     : 펼쳐졌을 때만 하위 메뉴를 그린다.
                //
                // 접근성 속성 3개가 짝을 이룬다:
                //   aria-expanded  → 지금 펼쳐졌는지(true/false)를 알린다
                //   aria-controls  → "내가 조종하는 영역은 이 id다"라고 연결한다
                //   id={submenuId} → 그 영역에 같은 id를 붙여 짝을 맞춘다
                //
                // onClick={() => toggleNavigationGroup(id)} 처럼 화살표로 감싼 이유:
                //   인자를 넘겨야 하기 때문이다. 감싸지 않고 toggleNavigationGroup(id)라고 쓰면
                //   그리는 즉시 실행돼 버려서 무한 루프에 빠진다.
                return <><button type="button" className="sidebar-group-toggle" aria-expanded={expanded} aria-controls={submenuId} aria-label={`${navigationGroup.title} 메뉴 ${expanded ? "접기" : "펼치기"}`} onClick={() => toggleNavigationGroup(navigationGroup.id)}><span className="sidebar-navigation-symbol" aria-hidden="true">{navigationGroup.symbol}</span><span className="sidebar-expandable-content sidebar-group-toggle-copy"><strong>{navigationGroup.title}</strong><span className="sidebar-group-arrow" aria-hidden="true">{expanded ? "▴" : "▾"}</span></span></button>{expanded ? <div className="sidebar-navigation-submenu" id={submenuId}>{renderNavigationItems(navigationGroup)}</div> : null}</>;
              // ↓ 여기가 삼항 연산자의 `:` 쪽. 접을 수 없는 그룹은 제목 + 목록만 그린다.
              })() : <><h2 className="sidebar-group-title sidebar-expandable-content">{navigationGroup.title}</h2>{renderNavigationItems(navigationGroup)}</>}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer sidebar-expandable-content">
          <div className="sidebar-account-panel"><AuthenticationControls /></div>
          <button type="button" className="sidebar-theme-button" onClick={toggleApplicationTheme} aria-label={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}><span>{applicationTheme === "dark" ? "☀" : "☾"}</span>{applicationTheme === "dark" ? "라이트 모드" : "다크 모드"}</button>
          {/* 데이터 소스(진짜 서버 / 가짜 서버) 전환 스위치는
              React 학습 영역에서만 필요하므로 그때만 보여준다.
              `compact`처럼 값 없이 이름만 쓰면 `compact={true}`와 같은 뜻이다. */}
          {location.pathname.startsWith("/react") ? <DataSourceToggle compact /> : null}
        </div>
      </aside>

      {/* 모바일에서 사이드바가 열렸을 때 뒤에 깔리는 반투명 배경막.
          아무 데나 누르면 메뉴가 닫히는, 익숙한 그 동작이다.

          ★ <div onClick={...}>이 아니라 <button>을 쓴 이유
            div에 onClick을 붙이면 마우스로는 눌리지만
            키보드 Tab으로 접근할 수도, Enter로 누를 수도 없다.
            button은 그 모든 걸 브라우저가 공짜로 해 준다.
            "클릭할 수 있는 것은 button 또는 a로 만든다"가 접근성의 기본 규칙이다.

          isMobileSidebarOpen이 false면 null → 아예 DOM에 존재하지 않는다.
          CSS로 숨기는 것과 달리, 없는 요소는 키보드로도 절대 선택되지 않아 더 안전하다. */}
      {isMobileSidebarOpen ? <button className="mobile-sidebar-backdrop" type="button" onClick={closeMobileSidebar} aria-label="모바일 사이드바 닫기" /> : null}
    </>
  );
};
