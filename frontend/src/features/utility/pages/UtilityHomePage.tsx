/**
 * ============================================================================
 * UtilityHomePage.tsx — 개발자 유틸리티 허브
 * ============================================================================
 *
 * [왜 카드를 분류했나]
 *   도구가 22개가 되면서 한 줄로 늘어놓으면 원하는 것을 찾기 어려워졌다.
 *   "지금 무슨 일을 하려는가"를 기준으로 묶으면 훑어보는 시간이 줄어든다.
 *   묶음 자체가 "이 사이트에 어떤 도구가 있는지"를 설명하는 역할도 한다.
 *
 * [각 카드에 담은 것]
 *   - title       : 도구 이름
 *   - description : 무엇을 하는 도구인지 (한 문장)
 *   - useCase     : 언제 쓰면 좋은지 (실제 상황)
 *   description 만 있으면 "그래서 언제 쓰지?"가 남는다.
 *   처음 방문한 사람이 판단할 수 있도록 사용 상황을 함께 적었다.
 */

import { Link } from "react-router-dom";

interface UtilityCard {
  to: string;
  symbol: string;
  title: string;
  description: string;
  /** 이 도구를 언제 쓰면 좋은지. 처음 보는 사람이 고를 수 있게 돕는다. */
  useCase: string;
}

interface UtilityGroup {
  groupTitle: string;
  groupDescription: string;
  cards: UtilityCard[];
}

const utilityGroups: UtilityGroup[] = [
  {
    groupTitle: "API 개발과 테스트",
    groupDescription: "요청을 만들고 응답을 확인하며, 서버가 아직 없을 때도 흐름을 검증합니다.",
    cards: [
      {
        to: "/utilities/api-workspace",
        symbol: "↗",
        title: "API Workspace",
        description: "요청 작성·응답 분석·History·Collection을 한 화면에서 관리합니다.",
        useCase: "새 API를 붙이기 전에 요청과 응답을 먼저 확인하고 싶을 때",
      },
      {
        to: "/utilities/api-workspace/openapi",
        symbol: "OAS",
        title: "OpenAPI Studio",
        description: "OpenAPI 3.x 문서를 분석하고 선택한 API를 Collection으로 가져옵니다.",
        useCase: "Swagger 문서를 받았는데 요청을 하나씩 손으로 만들기 번거로울 때",
      },
      {
        to: "/utilities/api-workspace/realtime",
        symbol: "WS",
        title: "WebSocket · SSE Tester",
        description: "실시간 연결·재연결과 송수신 메시지를 시간순으로 확인합니다.",
        useCase: "실시간 알림이나 채팅 기능이 제대로 붙었는지 확인할 때",
      },
      {
        to: "/utilities/api-workspace/mock",
        symbol: "MK",
        title: "Mock API Scenario",
        description: "고정·순차·무작위 응답과 지연·오류 상황을 반복 테스트합니다.",
        useCase: "백엔드가 아직 없거나, 느린 응답·서버 오류 화면을 만들어 봐야 할 때",
      },
      {
        to: "/utilities/cors-inspector",
        symbol: "CO",
        title: "CORS · Header Inspector",
        description: "Origin·Preflight·Credentials와 보안·Cache Header를 진단합니다.",
        useCase: "브라우저 콘솔에 CORS 오류가 떴는데 원인을 못 찾을 때",
      },
    ],
  },
  {
    groupTitle: "데이터 변환과 조회",
    groupDescription: "형식을 바꾸거나, 큰 데이터에서 필요한 부분만 찾아냅니다.",
    cards: [
      {
        to: "/utilities/converter",
        symbol: "◇",
        title: "Data Converter",
        description: "JSON·YAML·XML 변환과 TypeScript·Java DTO 초안을 만듭니다.",
        useCase: "받은 JSON으로 DTO 클래스를 만들어야 할 때",
      },
      {
        to: "/utilities/json-csv",
        symbol: "⇄",
        title: "JSON ↔ CSV Converter",
        description: "JSON 객체 배열과 CSV 표 데이터를 양방향으로 안전하게 변환합니다.",
        useCase: "API 응답을 엑셀로 옮기거나, 엑셀 데이터를 테스트에 쓸 때",
      },
      {
        to: "/utilities/jsonpath",
        symbol: "JP",
        title: "JSONPath Explorer",
        description: "JSON 트리에서 조건에 맞는 경로와 값을 검색·추출합니다.",
        useCase: "응답이 너무 깊고 커서 원하는 값의 경로를 찾기 어려울 때",
      },
      {
        to: "/utilities/test-data",
        symbol: "▦",
        title: "Test Data Generator",
        description: "규칙 기반 테스트 데이터를 JSON·CSV·SQL로 생성합니다.",
        useCase: "목록 화면이나 페이징을 시험하려는데 데이터가 몇 건 없을 때",
      },
    ],
  },
  {
    groupTitle: "코드 작성 보조",
    groupDescription: "코드를 정리·비교하거나, 자주 쓰는 표현을 만들어 둡니다.",
    cards: [
      {
        to: "/utilities/formatter",
        symbol: "{ }",
        title: "Code Formatter",
        description: "JSON·HTML·CSS·JavaScript·SQL을 읽기 좋게 정리합니다.",
        useCase: "로그에서 복사한 한 줄짜리 JSON이나 SQL을 읽어야 할 때",
      },
      {
        to: "/utilities/diff",
        symbol: "±",
        title: "Code Diff",
        description: "변경 전후 코드를 줄·인라인 단위로 비교하고 패치를 다운로드합니다.",
        useCase: "무엇이 바뀌었는지 눈으로 확인하고 싶을 때",
      },
      {
        to: "/utilities/regex",
        symbol: ".*",
        title: "Regex Tester",
        description: "JavaScript·Java 엔진으로 찾기·전체 일치·치환과 그룹을 학습합니다.",
        useCase: "정규식이 왜 안 맞는지 모르겠고, Java와 결과가 다를 때",
      },
      {
        to: "/utilities/cron",
        symbol: "◷",
        title: "Cron Generator",
        description: "Spring·Linux Cron을 만들고 다음 실행 시간을 확인합니다.",
        useCase: "배치 주기를 설정해야 하는데 Cron 표현식이 헷갈릴 때",
      },
      {
        to: "/utilities/markdown",
        symbol: "M↓",
        title: "Markdown Editor",
        description: "Markdown을 작성·미리보기하고 MD·HTML로 내보냅니다.",
        useCase: "README나 문서를 쓰면서 결과를 바로 확인하고 싶을 때",
      },
      {
        to: "/utilities/tools",
        symbol: "Aa",
        title: "Quick Tools",
        description: "케이스·Base64·해시·시간·색상·비밀번호·HTTP 도구를 모았습니다.",
        useCase: "snake_case를 camelCase로 바꾸는 것 같은 짧은 작업이 필요할 때",
      },
    ],
  },
  {
    groupTitle: "설계와 분석",
    groupDescription: "구조를 그리고, 문제가 생긴 원인을 찾습니다.",
    cards: [
      {
        to: "/utilities/diagrams",
        symbol: "ERD",
        title: "Diagram Designer",
        description: "ERD·순서도를 그려 저장하고 버전으로 되돌립니다. SQL DDL을 붙여 넣어 자동 생성할 수도 있습니다.",
        useCase: "테이블 구조를 설계하거나, 기존 스키마를 그림으로 정리해 둘 때",
      },
      {
        to: "/utilities/sql-erd",
        symbol: "DB",
        title: "SQL Schema · ERD",
        description: "CREATE TABLE DDL을 분석해 PK·FK와 테이블 관계를 시각화합니다.",
        useCase: "DDL만 있고 문서가 없는 DB의 구조를 빠르게 파악할 때",
      },
      {
        to: "/utilities/log-analyzer",
        symbol: "LOG",
        title: "Log · Stack Trace Analyzer",
        description: "Exception Chain, Root Cause, SQL 오류와 반복 로그를 분석합니다.",
        useCase: "스택 트레이스가 수백 줄인데 진짜 원인을 찾아야 할 때",
      },
      {
        to: "/utilities/dependencies",
        symbol: "DP",
        title: "Dependency Analyzer",
        description: "package.json·Gradle 의존성과 중복 해석 버전을 정리합니다.",
        useCase: "같은 라이브러리가 여러 버전으로 들어와 충돌이 의심될 때",
      },
    ],
  },
  {
    groupTitle: "보안과 기록",
    groupDescription: "토큰을 확인하거나, 팀과 공유할 내용을 남깁니다.",
    cards: [
      {
        to: "/utilities/jwt",
        symbol: "JWT",
        title: "JWT Decoder",
        description: "JWT Header·Payload와 시간 Claim을 저장 없이 디코딩합니다.",
        useCase: "토큰이 만료됐는지, 어떤 권한이 담겼는지 확인할 때",
      },
      {
        to: "/utilities/snippets",
        symbol: "</>",
        title: "Developer Snippet",
        description: "회원별 코드 조각 CRUD·검색·즐겨찾기·휴지통 복구를 제공합니다.",
        useCase: "자주 쓰는 설정이나 코드 조각을 저장해 두고 꺼내 쓸 때",
      },
      {
        to: "/utilities/polls",
        symbol: "%",
        title: "투표",
        description: "간단한 질문과 선택지를 만들고 결과를 비교합니다.",
        useCase: "팀에서 기술 선택이나 일정에 대한 의견을 모을 때",
      },
    ],
  },
];

export const UtilityHomePage = () => (
  <section className="site-page">
    <div className="page-hero">
      <span className="page-kicker">Developer Utility Board</span>
      <h1>개발할 때 반복해서 찾는 도구 모음</h1>
      <p>
        각 도구 화면 오른쪽 위의 <strong>?</strong> 버튼을 누르면 사용법과 주의사항을 볼 수 있습니다.
      </p>
    </div>

    {/*
      개인정보 안내를 허브에서 한 번 알린다.
      도구마다 도움말에도 같은 안내가 들어 있지만,
      "어떤 도구를 열까" 고민하는 단계에서 먼저 아는 편이 안심된다.
    */}
    <div className="utility-home-notice">
      <strong>입력한 데이터는 어디로 가나요?</strong>
      <p>
        대부분의 도구는 브라우저 안에서만 계산하며 서버로 보내지 않습니다.
        로그인이 필요한 Developer Snippet·투표·Diagram Designer만 내 계정에 저장됩니다.
      </p>
    </div>

    {/* 분류별로 나눠서 렌더링한다. 그룹을 추가하려면 위 배열에 한 덩어리만 넣으면 된다. */}
    {utilityGroups.map((group) => (
      <section className="utility-home-group" key={group.groupTitle}>
        <header className="utility-home-group-heading">
          <h2>{group.groupTitle}</h2>
          <p>{group.groupDescription}</p>
        </header>
        <div className="utility-card-grid">
          {group.cards.map((card) => (
            <Link className="utility-card" key={card.to} to={card.to}>
              <span>{card.symbol}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              {/* 사용 상황은 시각적으로 구분해 "설명"과 헷갈리지 않게 한다. */}
              <small className="utility-card-usecase">이럴 때 · {card.useCase}</small>
            </Link>
          ))}
        </div>
      </section>
    ))}
  </section>
);
