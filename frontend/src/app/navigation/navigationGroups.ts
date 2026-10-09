/**
 * 사이드바 메뉴 데이터. 사이드바(ApplicationSidebar)와 브라우저 탭 제목(DocumentTitle)이 같은 메뉴 이름을 쓰도록 한 곳에 모았다.
 * 메뉴를 추가하면 탭 제목도 자동으로 따라간다.
 */

// ----------------------------------------------------------------------------
// 1. 메뉴 데이터의 "모양"을 먼저 정의한다 (타입)
// ----------------------------------------------------------------------------

/** 메뉴 한 줄(링크 하나)의 모양. */
export interface NavigationItem {
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

/**
 * 그룹 안의 작은 묶음(3단계 메뉴). 메뉴가 많은 그룹(유틸리티)을 종류별로 나눠 접고 펼친다.
 *   1단계: 그룹(각종 유틸리티 게시판) → 2단계: 바로 가는 메뉴(유틸리티 홈·웹 크롤링 도구) + 작은 묶음 → 3단계: 묶음 안의 메뉴
 */
export interface NavigationSubgroup {
  id: string;                // 그룹 안에서 겹치지 않는 키(접기/펼치기 상태에 "그룹id:묶음id"로 쓴다)
  title: string;
  symbol: string;
  items: NavigationItem[];
}

/** 메뉴 묶음(그룹) 하나의 모양. */
export interface NavigationGroup {
  id: string;                // 접기/펼치기 상태를 구분하는 고유 키
  title: string;             // 그룹 제목
  symbol: string;
  collapsible: boolean;      // true면 클릭해서 접었다 폈다 할 수 있는 그룹
  items: NavigationItem[];   // `[]`는 "이 타입의 배열"이라는 뜻. 그룹을 펼치면 바로 보이는 메뉴(2단계)
  subgroups?: NavigationSubgroup[]; // 있으면 items 아래에 접고 펴는 작은 묶음(3단계)으로 보여 준다
}

/** 그룹의 모든 메뉴(2단계 + 3단계)를 한 줄로 편다. 탭 제목 찾기 등에 쓴다. */
export const flattenNavigationItems = (navigationGroup: NavigationGroup): NavigationItem[] =>
  [...navigationGroup.items, ...(navigationGroup.subgroups ?? []).flatMap((subgroup) => subgroup.items)];

// ----------------------------------------------------------------------------
// 2. 실제 메뉴 데이터
// ----------------------------------------------------------------------------
// 컴포넌트 바깥에 둔 이유: 이 값들은 절대 변하지 않는 고정 데이터다.
// 컴포넌트 안에 두면 화면을 다시 그릴 때마다 똑같은 배열을 계속 새로 만들게 된다.

export const portfolioNavigationGroup: NavigationGroup = {
  id: "portfolio",
  title: "홈과 기록",
  symbol: "PF",
  collapsible: false,
  items: [
    { label: "홈", description: "소개·연락처·Git·경력 CRUD · 섹션별 공개 설정", route: "/", symbol: "HM" },
    { label: "나의 업무 History", description: "트러블슈팅·개발 내용 기록", route: "/history", symbol: "HI", matchChildren: true },
  ],
};

export const reactNavigationGroup: NavigationGroup = {
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
    { label: "심화", description: "훅·성능·전역 상태·테스트", route: "/react/level/deep", symbol: "05" },
  ],
};

// 유틸리티는 메뉴가 많아 3단계로 나눈다. 묶음 이름·순서는 유틸리티 홈(UtilityHomePage) 분류와 맞췄다.
export const utilityNavigationGroup: NavigationGroup = {
  id: "utilities",
  title: "각종 유틸리티 게시판",
  symbol: "UT",
  collapsible: true,
  items: [
    { label: "유틸리티 홈", description: "개발 도구 전체 보기", route: "/utilities", symbol: "UT" },
    { label: "웹 크롤링 도구", description: "로그인·선택자·AND/OR 수집", route: "/utilities/crawler", symbol: "CR" },
  ],
  subgroups: [
    {
      id: "api",
      title: "API 개발·테스트",
      symbol: "API",
      items: [
        { label: "API Workspace", description: "요청·Collection·Runner", route: "/utilities/api-workspace", symbol: "API" },
        { label: "OpenAPI Studio", description: "API 문서·Collection 가져오기", route: "/utilities/api-workspace/openapi", symbol: "OAS" },
        { label: "WebSocket · SSE", description: "실시간 연결·메시지 로그", route: "/utilities/api-workspace/realtime", symbol: "WS" },
        { label: "Mock API", description: "지연·오류·순차 응답", route: "/utilities/api-workspace/mock", symbol: "MK" },
        { label: "CORS Inspector", description: "CORS·보안 Header 진단", route: "/utilities/cors-inspector", symbol: "CO" },
      ],
    },
    {
      id: "data",
      title: "데이터 변환·조회",
      symbol: "DT",
      items: [
        { label: "Data Converter", description: "JSON·YAML·XML 변환", route: "/utilities/converter", symbol: "CV" },
        { label: "JSON ↔ CSV", description: "JSON과 CSV 상호 변환", route: "/utilities/json-csv", symbol: "⇄" },
        { label: "JSONPath Explorer", description: "JSON 경로 검색·추출", route: "/utilities/jsonpath", symbol: "JP" },
        { label: "Test Data Generator", description: "테스트용 데이터 생성", route: "/utilities/test-data", symbol: "TG" },
      ],
    },
    {
      id: "code",
      title: "코드 작성 보조",
      symbol: "CD",
      items: [
        { label: "Code Formatter", description: "HTML·JS·CSS·SQL 정리", route: "/utilities/formatter", symbol: "{}" },
        { label: "SQL Formatter", description: "SQL 정렬·코멘트 주석·Java 출력", route: "/utilities/sql-formatter", symbol: "SQL" },
        { label: "Code Diff", description: "두 코드 차이 비교", route: "/utilities/diff", symbol: "±" },
        { label: "Regex Tester", description: "정규식 검색·치환", route: "/utilities/regex", symbol: ".*" },
        { label: "Cron Generator", description: "Cron 표현식 만들기", route: "/utilities/cron", symbol: "◷" },
        { label: "Markdown Editor", description: "마크다운 작성·미리보기", route: "/utilities/markdown", symbol: "M↓" },
        { label: "Quick Tools", description: "문자열·케이스 빠른 변환", route: "/utilities/tools", symbol: "Aa" },
      ],
    },
    {
      id: "design",
      title: "설계·분석",
      symbol: "ERD",
      items: [
        { label: "Diagram Designer", description: "ERD·순서도 작성·저장·버전관리", route: "/utilities/diagrams", symbol: "ERD", matchChildren: true },
        { label: "SQL Schema · ERD", description: "DDL 테이블 관계 시각화", route: "/utilities/sql-erd", symbol: "DB" },
        { label: "Log Analyzer", description: "Exception·Root Cause 분석", route: "/utilities/log-analyzer", symbol: "LOG" },
        { label: "Dependency Analyzer", description: "NPM·Gradle 의존성 분석", route: "/utilities/dependencies", symbol: "DP" },
      ],
    },
    {
      id: "record",
      title: "보안·기록",
      symbol: "SEC",
      items: [
        { label: "JWT Decoder", description: "JWT Header·Payload 확인", route: "/utilities/jwt", symbol: "JWT" },
        { label: "Developer Snippet", description: "회원별 코드 조각 CRUD", route: "/utilities/snippets", symbol: "</>" },
        { label: "투표", description: "토픽 생성·참여·결과", route: "/utilities/polls", symbol: "%" },
      ],
    },
  ],
};

export const administratorNavigationGroup: NavigationGroup = {
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

