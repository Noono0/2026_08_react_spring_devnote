import { Link } from "react-router-dom";

const utilities = [
  { to: "/utilities/api-workspace", symbol: "↗", title: "API Workspace", description: "요청 작성·응답 분석·History·Collection을 한 화면에서 관리합니다." },
  { to: "/utilities/api-workspace/openapi", symbol: "OAS", title: "OpenAPI Studio", description: "OpenAPI 3.x 문서를 분석하고 선택한 API를 Collection으로 가져옵니다." },
  { to: "/utilities/api-workspace/realtime", symbol: "WS", title: "WebSocket · SSE Tester", description: "실시간 연결·재연결과 송수신 메시지를 시간순으로 확인합니다." },
  { to: "/utilities/api-workspace/mock", symbol: "MK", title: "Mock API Scenario", description: "고정·순차·무작위 응답과 지연·오류 상황을 반복 테스트합니다." },
  { to: "/utilities/regex", symbol: ".*", title: "Regex Tester", description: "JavaScript·Java 엔진으로 찾기·전체 일치·치환과 그룹을 학습합니다." },
  { to: "/utilities/formatter", symbol: "{ }", title: "Code Formatter", description: "JSON·HTML·CSS·JavaScript·SQL을 읽기 좋게 정리합니다." },
  { to: "/utilities/converter", symbol: "◇", title: "Data Converter", description: "JSON·YAML·XML 변환과 TypeScript·Java DTO 초안을 만듭니다." },
  { to: "/utilities/json-csv", symbol: "⇄", title: "JSON ↔ CSV Converter", description: "JSON 객체 배열과 CSV 표 데이터를 양방향으로 안전하게 변환합니다." },
  { to: "/utilities/diff", symbol: "±", title: "Code Diff", description: "변경 전후 코드를 줄·인라인 단위로 비교하고 패치를 다운로드합니다." },
  { to: "/utilities/jwt", symbol: "JWT", title: "JWT Decoder", description: "JWT Header·Payload와 시간 Claim을 저장 없이 디코딩합니다." },
  { to: "/utilities/markdown", symbol: "M↓", title: "Markdown Editor", description: "Markdown을 작성·미리보기하고 MD·HTML로 내보냅니다." },
  { to: "/utilities/test-data", symbol: "▦", title: "Test Data Generator", description: "규칙 기반 테스트 데이터를 JSON·CSV·SQL로 생성합니다." },
  { to: "/utilities/snippets", symbol: "</>", title: "Developer Snippet", description: "회원별 코드 조각 CRUD·검색·즐겨찾기·휴지통 복구를 제공합니다." },
  { to: "/utilities/cron", symbol: "◷", title: "Cron Generator", description: "Spring·Linux Cron을 만들고 다음 실행 시간을 확인합니다." },
  { to: "/utilities/tools", symbol: "Aa", title: "Quick Tools", description: "케이스·Base64·해시·시간·색상·비밀번호·HTTP 도구를 모았습니다." },
  { to: "/utilities/polls", symbol: "%", title: "투표", description: "간단한 질문과 선택지를 만들고 결과를 비교합니다." },
  { to: "/utilities/jsonpath", symbol: "JP", title: "JSONPath Explorer", description: "JSON 트리에서 조건에 맞는 경로와 값을 검색·추출합니다." },
  { to: "/utilities/sql-erd", symbol: "DB", title: "SQL Schema · ERD", description: "CREATE TABLE DDL을 분석해 PK·FK와 테이블 관계를 시각화합니다." },
  { to: "/utilities/log-analyzer", symbol: "LOG", title: "Log · Stack Trace Analyzer", description: "Exception Chain, Root Cause, SQL 오류와 반복 로그를 분석합니다." },
  { to: "/utilities/cors-inspector", symbol: "CO", title: "CORS · Header Inspector", description: "Origin·Preflight·Credentials와 보안·Cache Header를 진단합니다." },
  { to: "/utilities/dependencies", symbol: "DP", title: "Dependency Analyzer", description: "package.json·Gradle 의존성과 중복 해석 버전을 정리합니다." },
];
export const UtilityHomePage = () => <section className="site-page"><div className="page-hero"><span className="page-kicker">Developer Utility Board</span><h1>개발할 때 반복해서 찾는 도구 모음</h1><p>입력 데이터는 브라우저에서 처리하는 도구부터 시작하고, 공유가 필요한 기능은 서버 API로 확장합니다.</p></div><div className="utility-card-grid">{utilities.map((utility) => <Link className="utility-card" key={utility.to} to={utility.to}><span>{utility.symbol}</span><h2>{utility.title}</h2><p>{utility.description}</p></Link>)}</div></section>;
