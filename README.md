# DevNote Portfolio & React Beginner-to-Advanced Lab

> **기능별 상세 문서**
> - [Diagram Designer](docs/diagram-designer.md) — ERD·순서도 편집, SQL ↔ ERD 변환, 버전 관리, 사용 오픈소스와 라이선스

첫 화면은 실제 포트폴리오로 사용하고, `/react` 아래에서는 React 왕초보가 단순한 상태 변경부터 **폼, Effect, 비동기, 접근성, 다양한 CRUD와 Spring Boot·MyBatis·MySQL 실무 흐름까지 단계별로 연습하는 프로젝트**입니다.

## 사이트 구성과 로그인

- `/`: 소개, 자유 글, 이미지, 기술, 경력, 프로젝트, 교육, 자격·인증과 연락처를 원하는 순서로 배치하는 자체 제작 블록형 포트폴리오입니다. 슈퍼관리자는 블록을 추가·수정·복제·삭제·정렬하고 각각 공개 또는 비공개로 전환할 수 있습니다.
- `/history`: 트러블슈팅과 개발 경험을 기록하는 공개 업무 History입니다. 기존 문서 에디터의 이미지 붙여넣기·드래그 앤 드롭·첨부파일을 재사용합니다.
- `/react`: 왕초보·초급·중급·고급 필터와 기존 React 학습 로드맵입니다.
- `/utilities`: API Workspace부터 Regex, Formatter, Converter, Diff, JWT, Markdown, 테스트 데이터, 회원별 Snippet, Cron, Quick Tools와 서버 공유 토픽 투표까지 제공합니다.
- `/admin`: 관리자와 슈퍼관리자에게만 보이는 회원·등급·권한·일간·월간 방문 통계와 최근 이용 이력 메뉴입니다.

데스크톱 내비게이션은 별도 상단 메뉴 없이 하나의 왼쪽 사이드바로 통합합니다. 홈·업무 History, React 전체 로드맵과 왕초보·초급·중급·고급, 구현된 유틸리티 화면을 같은 메뉴에서 이동하며 관리자 항목은 관리자 역할에만 추가로 표시됩니다. 모바일에서는 화면 폭을 확보하기 위해 햄버거 버튼으로 이 사이드바를 엽니다.

비회원도 공개 화면과 유틸리티를 사용할 수 있습니다. 가입 회원은 `BRONZE`·`USER`로 시작하며 등급은 `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`, `DIAMOND`, 역할은 `USER`, `ADMIN`, `SUPER_ADMIN`을 사용합니다. 포트폴리오와 업무 History 편집 버튼은 로그인한 `SUPER_ADMIN`에게만 표시됩니다.

로컬 초기 슈퍼관리자는 `admin / admin1234`입니다. 별도의 포트폴리오 편집 비밀번호는 사용하지 않습니다. 외부 배포 전에는 `.env`의 `INITIAL_SUPER_ADMIN_PASSWORD_HASH`를 교체하고 HTTPS 환경에서는 `SESSION_COOKIE_SECURE=true`로 설정해야 합니다. 로그인은 HttpOnly·SameSite 쿠키 세션으로 유지합니다. 로그인 모달의 `아이디 기억`은 ID만 브라우저에 저장하고, `자동 로그인`은 비밀번호를 저장하지 않은 채 세션 쿠키와 서버 세션 만료를 최대 30일로 연장합니다. 명시적으로 로그아웃하면 자동 로그인 쿠키는 즉시 만료됩니다.

하나의 게시판에 기능만 계속 추가하지 않고 다음처럼 데이터 구조와 화면 방식이 서로 다른 CRUD를 따로 구현했습니다.

```text
React 기초
  → 할 일 인라인 CRUD
  → 연락처 Reducer CRUD
  → 상품 모달 CRUD
  → 실시간 검색 자동완성
  → 일반 페이지형 게시판
  → 이미지 썸네일 게시판
  → 댓글·대댓글 계층형 CRUD
  → 예약 중복 검증 CRUD
  → 업무·칸반 비동기 CRUD
  → 문의·답변 권한 CRUD
  → 카테고리 트리 CRUD
  → Spring Boot 문서·파일 CRUD
  → 관리자 일괄 처리 CRUD
```

실제 문서 API의 전체 흐름은 다음과 같습니다.

```text
사용자 화면 조작
  → React Page 또는 Component
  → TanStack Query Hook
  → Axios 또는 Fetch
  → Vite Proxy 또는 Nginx
  → Spring Controller
  → Service 트랜잭션
  → DAO / SqlSessionTemplate
  → MyBatis XML
  → P6Spy 실제 파라미터 SQL
  → MySQL
```

## 0. 난이도별 CRUD 학습 로드맵

Docker 실행 후 `/react`에서 아래 단계를 확인할 수 있습니다. 과거 경로는 새 `/react` 경로로 자동 이동합니다.

| 단계 | 경로 | 난이도 | React 시나리오 | 주요 학습 내용 | 데이터 위치 |
|---:|---|---:|---|---|---|
| 1 | `/react/fundamentals` | 1/10 | React 화면 기초 | `useState`, 이벤트, 조건부 렌더링 | React State |
| 2 | `/react/todos` | 2/10 | 할 일 인라인 CRUD | 배열 추가·수정·삭제, 불변성 | React State |
| 3 | `/react/contacts` | 3/10 | 연락처 Reducer CRUD | `useReducer`, 검색, 복원 | `localStorage` |
| 4 | `/react/modal-products` | 4/10 | 상품 모달 CRUD | 추가·수정 Modal, 삭제 Confirm | React State |
| 5 | `/react/search-autocomplete` | 5/10 | 실시간 검색 자동완성 | Effect, debounce, 요청 취소, 키보드 접근성 | 비동기 로컬 API |
| 6 | `/react/general-board` | 5/10 | 일반 페이지형 게시판 | 목록·작성·상세·수정·검색·페이징 | React State |
| 7 | `/react/gallery` | 6/10 | 이미지 갤러리 게시판 | 파일 선택, 썸네일, 표/카드 전환, 미리보기 | React State + Data URL |
| 8 | `/react/comments` | 6.5/10 | 댓글·대댓글 CRUD | 부모·자식 관계, 인라인 편집, 삭제 자리 유지 | React State |
| 9 | `/react/reservations` | 7/10 | 예약 관리 CRUD | 날짜·시간, 중복 검증, 상태 전이 | React State |
| 10 | `/react/tasks` | 7.5/10 | 업무·칸반 CRUD | TanStack Query, Mutation, 낙관적 업데이트 | 비동기 로컬 API |
| 11 | `/react/inquiries` | 8/10 | 문의·답변 CRUD | USER/MANAGER/ADMIN 권한, 답변, 상태 | React State |
| 12 | `/react/categories` | 8.5/10 | 카테고리 트리 CRUD | 재귀 렌더링, 하위 추가, 순서, 삭제 제한 | React State |
| 13 | `/react/documents` | 9/10 | 문서·에디터·이미지 CRUD | Axios/Fetch, MSW, Tiptap, 파일, MyBatis | Spring Boot + MySQL 또는 MSW |
| 14 | `/react/admin-users` | 9.5/10 | 관리자 사용자 CRUD | 다중 선택, 일괄 역할·상태 변경, Soft Delete·복구 | React State |
| 실험실 | `/react/development/scenarios` | 10/10 | 오류·네트워크 실험 | 지연, 빈 결과, 401, 409, 500, 네트워크 오류 | MSW |

### 화면별 학습 가이드 아이콘

모든 화면 오른쪽 상단에 `?` 아이콘이 있습니다. 누르면 현재 화면 전용 학습 가이드 모달이 열립니다.

내용이 긴 학습 가이드·유틸리티 도움말·에디터·API 작업 모달은 데스크톱에서 오른쪽 아래 `◢` 핸들을 드래그해 가로·세로 크기를 조절할 수 있습니다. 핸들에 포커스를 두고 방향키를 눌러도 조절되며, `Shift + 방향키`는 더 크게 변경합니다. 조절한 크기는 브라우저에 저장되고 핸들을 더블클릭하면 기본 크기로 초기화됩니다. 모바일에서는 화면에 맞춘 반응형 모달을 사용합니다.

가이드 모달 탭:

- **사용 방법**: 실제 버튼을 누르는 순서와 자주 발생하는 실수
- **학습 내용**: 이번 화면에서 배우는 React·CRUD 개념과 관련 파일
- **소스 흐름**: 이벤트부터 상태·API·백엔드까지의 실행 순서
- **실습 과제**: 기본·응용 기능을 직접 확장하는 과제

공통 구현 파일:

```text
frontend/src/features/curriculum/components/LearningGuideButton.tsx
frontend/src/features/curriculum/data/learningGuides.ts
frontend/src/app/components/ApplicationTopBar.tsx
```

### CRUD 화면 방식 비교

모든 게시판을 같은 방식으로 만들지 않았습니다.

| 방식 | 적용 화면 | 배우는 이유 |
|---|---|---|
| 인라인 추가·수정 | 할 일, 댓글, 카테고리 | 적은 필드를 빠르게 바꾸는 방법 |
| Form Modal | 상품, 예약 | 목록을 유지하면서 여러 입력을 처리하는 방법 |
| Confirm Modal | 상품 삭제, 댓글 삭제, 예약 취소 | 위험 작업을 실행 전에 다시 확인하는 방법 |
| 목록·작성·상세 페이지 | 일반 게시판, 문서 | URL과 화면 책임을 분리하는 방법 |
| 카드·썸네일·표 전환 | 이미지 갤러리, 문서 | 데이터 성격에 따라 목록 UI를 바꾸는 방법 |
| 부모·자식 계층 | 댓글·대댓글 | 관계형 데이터를 화면에 중첩 표시하는 방법 |
| 재귀 트리 | 카테고리 | 여러 depth를 가진 메뉴·카테고리 구조 처리 |
| 칸반 상태 전환 | 업무 관리 | 서버 상태와 화면 상태, 낙관적 업데이트 |
| 다중 선택·일괄 처리 | 관리자 사용자 | 대형 관리 테이블의 실무 패턴 |

## 1. 공통 화면 기능

- 왼쪽 사이드 메뉴 접기·펼치기
- 모바일 햄버거 메뉴와 사이드바 Drawer
- 라이트 모드·다크 모드 전환
- 사이드바 접힘 상태와 테마를 `localStorage`에 저장
- 모든 화면의 학습 가이드 `?` 모달
- 문서 목록의 표·썸네일 카드 전환
- 대표 이미지 업로드와 이미지 로딩 실패 처리
- 왼쪽 사이드바에서 **더미 데이터 ON/OFF**
- Axios·Fetch 실행 방식 전환
- 개발 오류 시나리오와 디버그 패널
- Sonner 성공·경고·오류 알림
- 초보자가 흐름을 확인할 수 있는 개발 로그

## 1.1 더미 데이터 ON/OFF

왼쪽 사이드바 하단 스위치에서 데이터 소스를 전환합니다.

```text
더미 데이터 OFF
  → 문서 화면이 Spring Boot API를 호출
  → Controller → Service → DAO → MyBatis → MySQL

더미 데이터 ON
  → 문서 화면의 같은 API 요청을 MSW가 가로채서 응답
  → 백엔드가 실행되지 않아도 프론트 문서 CRUD 연습 가능
```

선택 상태는 `localStorage`에 저장되며 전환 시 MSW 초기화를 위해 화면이 새로고침됩니다.

할 일·연락처·상품·검색·일반 게시판·갤러리·댓글·예약·문의·카테고리·관리자 화면은 **React 상태와 사용자 상호작용 패턴 자체를 학습하기 위한 독립 실습 화면**입니다. 실제 REST·MyBatis·MySQL 연결은 13단계 문서 CRUD에서 학습합니다.

## 1.2 현재 포함된 React 기능

- React 19 + TypeScript strict + Vite
- 난이도별 14개 React 학습 단계와 개발 오류 실험실
- 화면별 사용 설명서·학습 내용·소스 흐름·과제 모달
- `useState` 인라인 할 일 CRUD
- `useReducer + localStorage` 연락처 CRUD
- React Hook Form + Zod 상품 모달 CRUD
- `useEffect` debounce, `AbortController`, 최신 요청 보호를 다루는 검색 자동완성
- 방향키·Enter·Escape와 ARIA Combobox를 사용하는 키보드 접근성
- 일반 게시판 목록·작성·상세·수정·삭제·검색·페이지네이션
- 이미지 파일 선택·썸네일 카드·표 전환·미리보기·수정·삭제
- 댓글·대댓글 부모·자식 CRUD와 삭제 자리 유지
- 예약 추가·수정·취소 Modal과 시간 중복 검증
- TanStack Query 업무 CRUD와 낙관적 업데이트·롤백
- USER·MANAGER·ADMIN 역할별 문의·답변·상태 전이
- 카테고리 재귀 트리, 하위 추가, 이름 수정, 순서 변경, 삭제 제한
- 관리자 사용자 다중 선택, 일괄 역할·상태 변경, Soft Delete·복구, 감사 로그
- Spring Boot 문서 목록·상세·생성·수정·삭제
- 문서 표 목록·썸네일 카드 보기 전환
- Tiptap 워드프로세서형 고정 툴바: H1~H6·글꼴·글자 크기(8pt~72pt)·색상·형광펜·정렬·목록·체크리스트·Office 방식 10×10 표 격자 선택·최대 50×50 직접 입력·열 너비와 행 높이 조절·셀 병합·분할·셀 배경색·링크·이미지·배율·실행 취소. 최종 화면에서는 모든 표가 카드 폭에 맞춰지고, 10열 초과 표는 글자와 셀 여백을 줄인 조밀한 한 화면 보기로 표시됩니다.
- 클립보드 이미지 붙여넣기·드래그 업로드와 이미지 전용 문서 저장
- 대표 이미지와 첨부파일 업로드·다운로드
- Axios·Fetch 공통 `HttpClient`
- 실제 API·MSW 더미 API 전환
- 정상·빈 데이터·지연·401·409·500·네트워크 오류
- Sonner 알림과 화면별 오류 표시
- Vitest + Testing Library 예제
- ESLint + Prettier

## 1.3 Spring Boot 기능

- Java 21 + Spring Boot 3.5.x + Gradle 8.14.4
- JPA Entity로 테이블 구조 표현
- 로컬 Docker의 `JPA_DDL_AUTO=update`로 기존 연습 DB 누락 컬럼 보정
- 실제 문서 CRUD·검색은 MyBatis XML과 `SqlSessionTemplate` 사용
- `Controller → Service → DAO → MyBatis XML` 구조
- 문서 CRUD, 소프트 삭제, 복구, 변경 이력
- 대표 이미지 검증과 `thumbnail_file_id` 저장
- `version_number` 기반 동시 수정 충돌
- 파일 업로드·다운로드와 `document_files` 연결
- 확장자·파일 크기·이미지 시그니처 검사
- `BusinessException + ErrorCode + ProblemDetail`
- `fieldErrors`, 안전한 사용자 메시지, `traceId`
- Springdoc OpenAPI / Swagger UI
- `schema.sql`·`data.sql` 기반 초기화와 연습 데이터
- P6Spy 바인딩 SQL 로그
- MyBatis mapper ID·실행 시간·결과 건수 로그
- Actuator Health·Liveness·Readiness
- Testcontainers MySQL 통합 테스트 예제

## 1.4 API Workspace

`/utilities/api-workspace`에서는 Postman과 비슷한 요청·응답 작업 화면을 연습할 수 있습니다.

- GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS 요청
- Query Parameter, Header, JSON·Text·Form Body
- No Auth, Bearer Token, Basic Auth, API Key
- 요청 Timeout과 실행 중 Cancel
- 응답 Body의 Pretty·Raw·HTML Preview, Header, 상태 코드 설명, 시간과 크기
- 상하·좌우 분할 전환과 환경변수 치환 후 URL·Header·Body를 확인하는 Actual Request
- 여러 요청 탭과 새로고침 후 작성 중 탭 복구
- 로그인 회원별 History 검색·단건/다중/전체 삭제와 삭제 실행 취소
- Collection 디렉터리 검색, Collection·Folder 이름 변경·삭제, 내부 새 요청 생성, Saved Request 저장·이동·복제·즐겨찾기·휴지통
- Environment 등록·수정·삭제·선택과 `{{baseUrl}}` 형식의 중첩 변수 치환
- Postman Collection v2.1·Environment JSON 가져오기·내보내기와 단일 요청 cURL 공유
- Collection에서 바로 여는 Runner의 요청 선택·1~10회 반복·요청 간격·중단·진행률·요청별 결과
- 매일 지정 시각 예약 실행, 활성화·중지·수정·삭제, 다음/최근 실행과 최근 30회 상세 이력
- 누락 환경변수와 순환 참조의 전송 전 오류 안내
- 비공개 실행과 Response Body 저장 선택

현재 단계는 **브라우저 직접 호출 방식**입니다. 대상 서버가 CORS를 허용해야 하며, 임의 외부 URL을 중계하는 백엔드 프록시는 SSRF 방어가 완성되기 전까지 제공하지 않습니다. History와 저장 요청은 회원 ID로 구분한 브라우저 저장소에 보관합니다. 이후 서버 동기화 단계에서 백엔드 인증 세션을 기준으로 DB 저장을 추가할 예정입니다.

Authorization, Cookie, API Key, Password, Access Token, Refresh Token, Client Secret은 열린 탭 복구·History·Saved Request에 원문으로 저장하지 않습니다. JSON Body의 민감한 키도 마스킹하며 form-data 파일은 저장하지 않으므로 다시 실행할 때 재선택해야 합니다. Environment의 Secret 값은 현재 화면 상태에서만 사용하며 새로고침 후 비워집니다. Response Body 저장은 기본값이 OFF입니다.

다른 API 테스트 도구와 이동할 때는 상단 `가져오기 · 내보내기`에서 Postman Collection v2.1 또는 Postman Environment JSON을 사용합니다. Collection 가져오기는 2MB·500개 요청, Environment는 200개 변수로 제한합니다. 중첩 Folder는 `상위 / 하위` 이름으로 평탄화합니다. 내보내기에서는 민감한 Header·Parameter 값을 `{{SECRET_VALUE}}` 같은 자리표시자로 바꾸고 Environment Secret 값은 비웁니다. Postman Collection 형식을 가져올 수 있는 도구에서도 같은 파일을 활용할 수 있지만 각 도구의 독자 확장 기능까지 완전히 호환하는 것은 아닙니다.

`Collection Runner`는 로그인 회원의 Saved Request를 선택한 순서대로 실행합니다. 즉시 실행과 예약 실행 모두 단일 요청 화면과 같은 환경변수·인증·Body·타임아웃·CORS 규칙을 사용합니다. 현재 예약은 브라우저 타이머 기반이므로 API Workspace 페이지가 열려 있어야 하며, 절전·브라우저 종료 중 놓친 일정은 같은 페이지를 다시 열었을 때 한 번 보정 실행합니다. 앱을 완전히 닫아도 정확한 시각에 실행하려면 Collection과 Secret의 서버 저장, 실행 대상 Host Allowlist, SSRF 방어, 분산 스케줄 잠금이 포함된 별도 백엔드 단계가 필요합니다.

## 1.5 JSON ↔ CSV Converter

`/utilities/json-csv`에서는 서버 전송 없이 브라우저 안에서 JSON 객체 배열과 CSV를 양방향 변환할 수 있습니다.

- JSON 객체 배열 → CSV, CSV → JSON 양방향 변환
- 쉼표·세미콜론·탭 구분자 선택
- Header 사용 여부와 숫자·boolean·null 타입 추론 선택
- 쉼표, 큰따옴표, 셀 내부 줄바꿈을 포함한 CSV 파싱
- 서로 다른 JSON 객체의 Key를 합쳐 Header 생성
- 중첩 객체·배열을 JSON 문자열 한 셀로 보존
- JSON·CSV 파일 불러오기, 결과 복사와 UTF-8 파일 다운로드
- 결과 앞 50행 표 미리보기와 전체 결과 다운로드
- 잘못된 JSON, 중복 Header, 열 개수 불일치 오류 안내

CSV는 단순히 `split(",")`로 나눌 수 없습니다. 이 예제의 `jsonCsvConverter.ts`는 문자 단위 상태 머신으로 따옴표가 열린 셀을 추적하므로, `"Backend, API"` 같은 값과 셀 안 줄바꿈도 하나의 값으로 처리합니다. 입력은 최대 2MB·10,000행까지 지원하며 변환 내용은 저장하거나 서버로 전송하지 않습니다.

## 1.6 토픽 투표

`/utilities/polls`는 회원이 질문과 문항을 자유롭게 만들고 비회원·회원이 함께 참여하는 서버 공유 투표입니다.

- 로그인 회원 누구나 투표 생성, 작성자와 관리자는 진행 중 투표 수정
- 서버 페이징으로 10·20·50개씩 조회하고 상태별로 필터링
- `목록 보기`와 `상세 보기` 탭을 전환하며, 목록에서 상태·문항 수·참여자 수·투표 수·종료 시간을 한눈에 확인
- 관리자와 슈퍼관리자는 확인창을 거쳐 투표를 소프트 삭제하고 기존 참여 이력은 DB에 보존
- 문항 2개로 시작하고 최대 10개까지 추가·삭제
- 단일 선택 또는 복수 선택, 복수 선택 시 2개부터 전체 문항 수 사이로 최대 선택 수 설정
- 생성 시 종료 일시 또는 1~60분 뒤 종료 설정, 미설정 시 60분 뒤 자동 종료
- 실시간 결과 공개 또는 종료 후 작성자가 결과 공개
- `투표 중 → 투표 종료 → 투표 결과 공개` 상태 흐름
- 5초 자동 갱신과 문항별 가로 막대그래프
- 결과 비공개 상태에서는 API 응답에서도 문항별 득표수를 숨김
- 한 번의 참여 묶음(ballot)에 여러 선택지를 저장하고 방문자별 재참여 방지

복수 선택 막대의 퍼센트는 전체 선택 횟수가 아니라 `해당 문항 선택자 ÷ 전체 참여자`로 계산합니다. 따라서 복수 선택 투표에서는 각 막대의 합이 100%를 넘을 수 있습니다. 이미 참여자가 있는 투표는 기존 득표 의미를 보존하기 위해 문항 내용과 개수를 고정하고, 제목·최대 선택 수·공개 방식·종료 시간만 수정할 수 있습니다.

## 1.7 개발 유틸리티 전체 목록

유틸리티 홈과 통합 왼쪽 사이드 메뉴에서 아래 화면으로 이동할 수 있습니다. 큰 입력 도구는 React `lazy`와 `Suspense`로 분리해 첫 화면 번들에 한꺼번에 포함하지 않습니다.

| 경로 | 화면 | 주요 기능 | 처리·저장 위치 |
|---|---|---|---|
| `/utilities/api-workspace` | API Workspace | HTTP 요청, 응답 분석, History, Collection·Folder·Saved Request, Environment, Collection Runner·매일 예약, Postman v2.1·cURL 공유, 코드 생성 | 브라우저 실행·회원별 로컬 저장 |
| `/utilities/regex` | Regex Tester | JavaScript·Java 실제 엔진, 찾기·전체 일치·치환, 그룹, 초보자 설명 | JS는 브라우저, Java는 Spring API, 저장 안 함 |
| `/utilities/formatter` | Code Formatter | JSON·JS·TS·CSS·HTML·SQL·Markdown 정리와 Minify | 브라우저, 저장 안 함 |
| `/utilities/converter` | Data Converter | JSON·YAML·XML, 키 정렬, JSON Tree, TS·Java DTO, JSON Schema | 브라우저, 저장 안 함 |
| `/utilities/json-csv` | JSON ↔ CSV | 구분자·Header·타입 추론, 표 미리보기, 파일 입출력 | 브라우저, 저장 안 함 |
| `/utilities/diff` | Code Diff | 좌우 줄·인라인 비교, 공백·대소문자 무시, Patch | 브라우저, 저장 안 함 |
| `/utilities/jwt` | JWT Decoder | Bearer 제거, Header·Payload, iat·exp·nbf 상태 | 브라우저, 저장 안 함 |
| `/utilities/markdown` | Markdown Editor | 시각적 서식 툴바, 할 일 목록·정렬 표·코드 강조, 분할 미리보기, HTML 정화, MD·HTML 내보내기 | 브라우저, 저장 안 함 |
| `/utilities/test-data` | Test Data Generator | 규칙 행·순서, Null·중복, JSON·CSV·SQL | 브라우저, 저장 안 함 |
| `/utilities/snippets` | Developer Snippet | 회원별 CRUD, 검색·정렬·페이징, 즐겨찾기, 휴지통 | Spring·MyBatis·MySQL |
| `/utilities/cron` | Cron Generator | Spring 6필드·Linux 5필드, 설명, 다음 실행, `@Scheduled` | 브라우저, 저장 안 함 |
| `/utilities/tools` | Quick Tools | naming case, Base64·URL, UUID·SHA, 시간대, 색상, 비밀번호, HTTP 상태 | 브라우저, 저장 안 함 |
| `/utilities/polls` | 토픽 투표 | 회원 생성, 비회원 참여, 복수 선택, 종료·결과 공개, 페이징 | Spring·MyBatis·MySQL |

### Regex Tester

- JavaScript는 브라우저 `RegExp`, Java는 `/api/v1/utilities/regex/java`에서 `Pattern`과 `Matcher`를 실제로 실행합니다.
- 입력은 100,000자, 결과는 200개로 제한하고 Java 실행은 1초 뒤 취소합니다.
- 중첩 수량자처럼 ReDoS 가능성이 큰 표현에는 실행 전 경고 또는 거부를 적용합니다.
- 패턴과 테스트 문자열은 DB, URL, 브라우저 저장소, 애플리케이션 로그에 저장하지 않습니다.
- 초보자 설명과 JavaScript 리터럴·생성자·Java Pattern 코드 복사는 학습 보조이며, 모든 엔진 고급 문법을 자동 해석한다고 가정하지 않습니다.

### Formatter·Converter·Diff·JWT·Markdown

- Code Formatter는 JSON을 실제 파서로 검증합니다. 다른 언어는 의존성을 늘리지 않은 경량 학습용 구현이므로 복잡한 JSX·Template Literal·SQL dialect 전체 AST를 지원하지 않습니다.
- Data Converter의 XML은 `DOCTYPE`과 `ENTITY`를 거부해 외부 Entity를 통한 네트워크 접근을 막습니다. 경량 YAML은 Anchor·Alias·다중 문서를, JSON Schema는 `type`, `required`, `properties`, `items`, `enum`을 지원합니다.
- Code Diff는 LCS 기반으로 최대 약 1,000줄씩 비교하며 원문을 저장하지 않습니다.
- JWT Decoder는 Base64URL 디코딩만 합니다. 서명 검증이나 토큰 신뢰성 확인이 아니며 비밀키 입력·토큰 생성 기능을 제공하지 않습니다.
- Markdown Editor는 H1~H6, 굵게·기울임·취소선·밑줄, 순서·비순서·할 일 목록, 인용, 세 가지 가로선, 링크·HTTP(S) 이미지, 정렬 표 버튼을 제공합니다. 입력·서식·초기화 이력을 최대 100개 보관해 `Ctrl+Z` 실행 취소와 `Ctrl+Y`·`Ctrl+Shift+Z` 다시 실행을 지원합니다. 언어를 선택한 코드 블록은 JavaScript·TypeScript·Python·Java·SQL·JSON·HTML·CSS·Bash를 의존성 없는 경량 방식으로 강조합니다. 선택 영역에 Markdown 문법을 적용하고 미리보기를 즉시 갱신하며, 변환한 HTML은 기존 DOMPurify로 정화합니다. Mermaid·로컬 이미지 업로드까지 포함하는 전체 GFM 편집기는 아닙니다.

### Test Data·Cron·Quick Tools

- Test Data는 최대 1,000행을 생성하고 이름·이메일·전화번호·숫자·금액·날짜·UUID·Boolean·Enum 등을 조합합니다. 규칙의 위·아래 순서를 바꾸고 MySQL·PostgreSQL·SQL Server별 식별자와 Boolean 표현을 선택할 수 있습니다.
- Cron은 숫자, `*`, Spring의 `?`, 간격, 범위, 목록을 검증합니다. `L`, `W`, `#` 같은 Quartz 고급 문법을 지원한다고 표시하지 않습니다. 다음 실행 시각은 현재 브라우저 시간대 기준입니다.
- Quick Tools의 SHA-256·파일 체크섬·비밀번호는 Web Crypto API를 사용합니다. 파일과 문자열을 서버로 전송하지 않습니다.

### Developer Snippet 서버 CRUD

로그인 세션의 회원 번호를 백엔드에서 찾고 모든 목록·상세·수정·삭제 SQL에 `member_id` 조건을 적용합니다. 프론트는 회원 번호를 저장 요청에 포함하지 않습니다.

- 제목, 설명, 언어, 최대 200,000자의 코드, 태그 10개, 즐겨찾기 저장
- 제목·설명·코드·태그 검색, 언어·즐겨찾기 필터, 최근 수정·제목·즐겨찾기 정렬
- 서버 페이징 10·20·50개, 현재 페이지 다중 선택 삭제·복구
- `use_yn`과 `deleted_at`을 이용한 소프트 삭제·휴지통 복구
- `Controller → Service → DAO → MyBatis XML → developer_snippets` 흐름

직접 API를 연습하려면 `http/developer-utilities.http`의 로그인, Java Regex, Snippet 생성·목록·수정·삭제·복구 요청을 순서대로 실행할 수 있습니다.

### API Workspace 저장 범위와 제한

API Workspace는 요청 실행·응답·History·Collection 기능을 모두 사용할 수 있지만 현재 단계의 회원별 데이터는 `member-{세션 회원 번호}`로 분리한 브라우저 `localStorage`에 저장합니다. 서버 DB 동기화는 아직 적용하지 않았으므로 다른 브라우저나 기기와 공유되지 않습니다.

브라우저 간 자동 동기화는 아니지만 Postman Collection v2.1·Environment JSON 파일로 내보낸 뒤 다른 브라우저나 호환 API 도구에서 수동으로 가져올 수 있습니다.

- History는 회원당 최신 100건으로 제한합니다.
- 열린 탭은 최대 8개만 임시 복구 데이터에 저장합니다.
- Authorization, Cookie, API Key, Password, Token, Client Secret과 민감한 JSON 키는 저장 전에 제거하거나 마스킹합니다.
- Environment Secret은 새로고침하면 비워지며 form-data 파일은 메타데이터만 남기고 다시 선택해야 합니다.
- `비공개 실행`은 History에 저장하지 않고 Response Body 저장은 기본 OFF입니다.
- Collection Runner 실행 이력은 최신 30회, 예약 설정은 회원별 브라우저 저장소에 보관합니다.
- 예약 실행은 페이지가 열린 동안 30초마다 도래 여부를 확인하며, 놓친 예약은 페이지 복귀 시 한 번 실행합니다.
- 요청은 브라우저에서 직접 실행하므로 대상 서버가 CORS를 허용해야 합니다. SSRF 위험이 있는 임의 URL 백엔드 프록시는 만들지 않았습니다.

### 추천 학습 순서

```text
/react
  → /react/fundamentals
  → /react/todos
  → /react/contacts
  → /react/modal-products
  → /react/search-autocomplete
  → /react/general-board
  → /react/gallery
  → /react/comments
  → /react/reservations
  → /react/tasks
  → /react/inquiries
  → /react/categories
  → /react/documents?viewMode=table
  → /react/documents?viewMode=thumbnail
  → /react/admin-users
  → /react/development/scenarios
```


### 백엔드가 `unhealthy`일 때

과거 버전에서 만든 MySQL Docker 볼륨을 재사용하면 기존 테이블에 새 컬럼이 없어 백엔드가 시작되지 않을 수 있습니다. 현재 Docker 기본 설정은 `JPA_DDL_AUTO=update`로 누락 컬럼을 로컬에서 보정합니다.

먼저 로그를 확인합니다.

```powershell
docker compose logs --tail=200 backend
```

이미지를 다시 만들려면:

```powershell
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

연습 데이터를 삭제해도 된다면:

```powershell
docker compose down -v
docker compose up --build -d
```

## Docker

맞습니다. **Docker로 전체 실행할 수 있게 구성되어 있습니다.**

`compose.yml` 하나로 다음 컨테이너가 함께 실행됩니다.

- MySQL 8.4
- Spring Boot Backend
- React 정적 빌드 + Nginx Frontend
- MySQL 영구 Volume
- 업로드 파일 영구 Volume
- Health Check와 컨테이너 시작 순서

---

# 2. 가장 쉬운 실행 방법: Docker Compose

## 2.1 필요한 프로그램

Docker 방식만 사용할 경우 아래 프로그램만 설치하면 됩니다.

### Windows

1. Docker Desktop 설치
2. 설치 후 Docker Desktop 실행
3. PowerShell 또는 명령 프롬프트 실행
4. 프로젝트 폴더로 이동

Docker Desktop에서 WSL 2 사용을 권장합니다.

### macOS

Docker Desktop을 설치하고 실행합니다.

### Linux

Docker Engine과 Docker Compose Plugin을 설치합니다.

설치 확인:

```bash
docker --version
docker compose version
```

## 2.2 환경설정 파일 생성

프로젝트 루트에서 실행합니다.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Windows 명령 프롬프트

```cmd
copy .env.example .env
```

### macOS / Linux / Git Bash

```bash
cp .env.example .env
```

기본값을 그대로 사용해도 됩니다.

```env
MYSQL_DATABASE=devnote
MYSQL_USERNAME=devnote
MYSQL_PASSWORD=devnote
MYSQL_ROOT_PASSWORD=root-devnote
MYSQL_PORT=3306
BACKEND_PORT=8080
FRONTEND_PORT=3000
VITE_API_BASE_URL=/api/v1
VITE_HTTP_CLIENT=axios
VITE_DATA_SOURCE=backend
INITIAL_SUPER_ADMIN_PASSWORD_HASH=600000:2519u3hcpq5hx8SaSCvL9A==:LQjLKoKo4WuJr2WDDpE3FAkNQCMtoPmH8e9U77Fa2Gc=
AUTH_SESSION_TIMEOUT=30m
SESSION_COOKIE_SECURE=false
```

## 2.3 전체 실행

### Windows

```cmd
start-docker.cmd
```

또는 직접 실행:

```cmd
docker compose up --build -d
```

### macOS / Linux / Git Bash

```bash
./start-docker.sh
```

또는 직접 실행:

```bash
docker compose up --build -d
```

처음 실행할 때 Gradle과 npm 의존성 및 Docker 이미지를 내려받기 때문에 인터넷 연결이 필요합니다.


## 2.9 소스 정적 검증

프로젝트 루트에서 다음 명령을 실행할 수 있습니다.

### Windows

```cmd
verify-static.cmd
```

### macOS / Linux / Git Bash

```bash
./verify-static.sh
```

이 검사는 JSON·XML·YAML·Shell 구문, TypeScript/TSX 구문, Java 구문, 프론트 로컬 import, DAO와 MyBatis statement ID, 썸네일·첨부파일·사이드바·테마 연결을 확인합니다. 의존성까지 포함한 실제 빌드 검사는 아래 명령을 별도로 실행해야 합니다.

```bash
cd frontend && npm install && npm run lint && npm run typecheck && npm run test && npm run build
cd ../backend && ./gradlew clean check
cd .. && docker compose up --build -d
```

> `package-lock.json`은 이 산출물 생성 환경에서 npm 저장소에 접근할 수 없어 생성하지 못했습니다. `package.json`의 직접 의존성 버전은 정확히 고정되어 있지만, 최초로 `npm install`이 성공한 뒤 생성되는 `package-lock.json`도 Git에 커밋하는 것이 좋습니다.

## 2.4 실행 상태 확인

```bash
docker compose ps
```

정상 상태 예시:

```text
devnote-mysql      healthy
devnote-backend    healthy
devnote-frontend   running
```

## 2.5 접속 주소

| 기능 | 주소 |
|---|---|
| React 화면 | http://localhost:3000 |
| Backend API | http://localhost:8080/api/v1 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| OpenAPI JSON | http://localhost:8080/v3/api-docs |
| Health | http://localhost:8080/actuator/health |
| Readiness | http://localhost:8080/actuator/health/readiness |
| MySQL | localhost:3306 |

React Docker 컨테이너의 Nginx가 `/api` 요청을 Backend 컨테이너로 전달합니다.

## 2.6 로그 보기

전체 로그:

```bash
docker compose logs -f
```

백엔드만:

```bash
docker compose logs -f backend
```

프론트 Nginx만:

```bash
docker compose logs -f frontend
```

MySQL만:

```bash
docker compose logs -f mysql
```

## 2.7 종료

```bash
docker compose down
```

Windows에서는 다음 파일도 사용할 수 있습니다.

```cmd
stop-docker.cmd
```

## 2.8 DB와 업로드 파일까지 완전히 초기화

> 이 명령은 모든 개발 데이터를 삭제합니다.

```bash
docker compose down -v
```

다시 실행하면 Spring Boot가 schema.sql과 data.sql을 사용해 필요한 테이블과 Seed 데이터를 확인합니다.

---

# 3. 로컬 개발 실행 방법

React와 Spring Boot 소스를 수정하면서 Hot Reload를 사용하려면 다음 방식이 편합니다.

```text
MySQL        Docker
Spring Boot 로컬 Java 프로세스
React        로컬 Vite 개발 서버
```

## 3.1 로컬 개발에 필요한 프로그램

- Git
- JDK 21
- Node.js 22.12 이상
- npm
- Docker Desktop 또는 로컬 MySQL 8.4

Gradle은 별도로 설치하지 않아도 됩니다. `backend/gradlew` 또는 `backend/gradlew.bat`가 최초 실행 시 Gradle 8.14.4를 내려받습니다. Docker 빌드는 공식 `gradle:8.14.4-jdk21` 이미지를 사용합니다.

설치 확인:

```bash
git --version
java -version
node --version
npm --version
docker --version
docker compose version
```

## 3.2 MySQL만 Docker로 실행

프로젝트 루트에서:

```bash
docker compose -f compose.dev.yml up -d
```

확인:

```bash
docker compose -f compose.dev.yml ps
```

## 3.3 Spring Boot 실행

### Gradle에서 자주 쓰는 명령

```bash
# 프로젝트 정보/Gradle 버전 확인
./gradlew --version

# 컴파일 + 테스트 + 품질 검증
./gradlew clean check

# 실행 가능한 Spring Boot JAR 생성
./gradlew clean bootJar

# Spring Boot 로컬 실행
./gradlew bootRun
```

Windows에서는 `./gradlew` 대신 `gradlew.bat`를 사용하면 됩니다.


### Windows PowerShell 또는 명령 프롬프트

```cmd
cd backend
gradlew.bat bootRun
```

### macOS / Linux / Git Bash

```bash
cd backend
chmod +x gradlew
./gradlew bootRun
```

기본 DB 연결값:

```text
URL      jdbc:p6spy:mysql://localhost:3306/devnote
Username devnote
Password devnote
```

`application.yml`은 다음 환경변수로 덮어쓸 수 있습니다.

```text
DATABASE_URL
DATABASE_USERNAME
DATABASE_PASSWORD
FILE_STORAGE_ROOT
SERVER_PORT
INITIAL_SUPER_ADMIN_PASSWORD_HASH
AUTH_SESSION_TIMEOUT
SESSION_COOKIE_SECURE
```

## 3.4 React 의존성 설치

새 터미널에서:

```bash
cd frontend
npm install
```

의존성 설치가 끝나면 브라우저 Mock API를 위한 Service Worker를 생성합니다.

```bash
npx msw init public --save
```

이 명령으로 `frontend/public/mockServiceWorker.js`가 만들어집니다.

처음 `npm install` 후 생성되는 `package-lock.json`은 Git에 커밋하는 것을 권장합니다. Dockerfile은 제공 환경에서 lock 파일이 없어도 시작할 수 있도록 `npm install`을 사용하지만, 팀 프로젝트에서는 `package-lock.json`을 만든 뒤 `npm ci`로 변경하는 편이 좋습니다.

## 3.5 React 실행

```bash
npm run dev
```

접속:

```text
http://localhost:5173
```

Vite가 `/api` 요청을 `http://localhost:8080`으로 전달합니다.

---

# 4. Axios와 Fetch 전환

파일:

```text
frontend/.env.development
```

Axios 사용:

```env
VITE_HTTP_CLIENT=axios
```

Fetch 사용:

```env
VITE_HTTP_CLIENT=fetch
```

환경변수를 변경한 뒤 Vite 서버를 다시 실행합니다.

```bash
npm run dev
```

구현 파일:

```text
frontend/src/shared/api/http/AxiosHttpClient.ts
frontend/src/shared/api/http/FetchHttpClient.ts
frontend/src/shared/api/http/selectedHttpClient.ts
```

화면과 Hook은 `selectedHttpClient`만 사용하므로 Axios와 Fetch를 바꿔도 기능 코드는 수정하지 않습니다.

주석 처리 방식으로 비교하고 싶다면 `selectedHttpClient.ts`의 설명된 두 줄 중 하나만 남겨도 됩니다. 다만 정상 개발에서는 환경변수 방식을 권장합니다.

---

# 5. 실제 Backend와 더미 데이터 전환

## 실제 Spring Boot 사용

```env
VITE_DATA_SOURCE=backend
```

## MSW 더미 API 사용

```env
VITE_DATA_SOURCE=mock
```

MSW 모드에서는 Spring Boot를 실행하지 않아도 React 기능을 연습할 수 있습니다.

가능한 Mock 시나리오:

| 시나리오 | 설명 |
|---|---|
| `success` | 정상 응답 |
| `empty-data` | 검색 결과 없음 |
| `slow-response` | 5초 지연 |
| `server-error` | HTTP 500 |
| `network-error` | 네트워크 연결 실패 |
| `unauthorized` | HTTP 401 |
| `version-conflict` | HTTP 409 동시 수정 충돌 |

React 상단 메뉴의 **개발 시나리오**에서 변경할 수 있습니다.

환경변수 기본값:

```env
VITE_MOCK_SCENARIO=success
```

MSW 시작 코드를 완전히 주석 처리하고 싶은 경우:

```text
frontend/src/main.tsx
```

다음 호출을 주석 처리합니다.

```typescript
await startMockServerWhenEnabled();
```

---

# 6. 로그인 계정과 학습용 회원 전환

실제 포트폴리오·업무 History·관리자 기능은 HttpOnly 세션 로그인으로 권한을 확인합니다.

| 로그인 ID | 초기 비밀번호 | 등급 | 역할 |
|---|---|---|---|
| `admin` | `admin1234` | `DIAMOND` | `SUPER_ADMIN` |

`ADMIN`과 `SUPER_ADMIN`은 관리자 메뉴를 볼 수 있고, 포트폴리오와 업무 History의 변경 기능은 `SUPER_ADMIN`만 사용할 수 있습니다. 초기 비밀번호는 로컬 확인용이므로 외부 배포 전에 반드시 교체합니다.

로그인 모달에서 `아이디 기억`을 선택하면 비밀번호가 아닌 로그인 ID만 `localStorage`에 저장합니다. `자동 로그인`을 선택하면 서버가 HttpOnly·SameSite 세션 쿠키를 최대 30일간 유지하며, 로그아웃할 때 쿠키와 자동 로그인 선택을 해제합니다. 기간은 `AUTH_REMEMBER_ME_DURATION`으로 조정할 수 있습니다.

`/react/documents`의 소유권 오류 실습은 로그인과 별개로 기존 `X-Member-Id` 헤더 전환 기능을 유지합니다. 이 헤더는 React 학습 API에서만 사용하는 개발 편의 기능이며 포트폴리오·업무 History·관리자 권한을 부여하지 않습니다.

| Member ID | 이메일 | 학습 데이터 역할 |
|---:|---|---|
| 1 | user@example.com | 초기 슈퍼관리자 소유 데이터 |
| 2 | manager@example.com | 다른 회원 소유 데이터 |
| 3 | admin@example.com | 관리자 역할 예제 |
| 4 | readonly@example.com | 일반 회원 예제 |

React 개발 메뉴에서 학습용 Member ID를 변경할 수 있습니다. API 직접 호출 시:

```http
X-Member-Id: 1
```

Seed 연습 문서 1번과 2번은 회원 1, 문서 3번은 회원 2 소유입니다. 업무 History는 `document_scope=HISTORY`로 별도 분리되어 연습 문서 API로 조회하거나 변경할 수 없습니다.

---

# 7. Backend 오류 응답

업무 오류는 `BusinessException`으로 발생시키고 `GlobalExceptionHandler`가 RFC Problem Details 형태로 변환합니다.

예시:

```json
{
  "type": "urn:devnote:error:document_version_conflict",
  "title": "DOCUMENT_VERSION_CONFLICT",
  "status": 409,
  "detail": "다른 사용자가 먼저 문서를 수정했습니다.",
  "instance": "/api/v1/documents/1",
  "errorCode": "DOCUMENT_VERSION_CONFLICT",
  "traceId": "43f5e4a64a0a40c69a02e37a246fd4ab",
  "timestamp": "2026-08-04T12:00:00Z",
  "fieldErrors": []
}
```

프론트 처리 기준:

- `errorCode`: 동작 분기 및 사용자 메시지 매핑
- `detail`: 프론트에 등록되지 않은 코드의 fallback 문구
- `fieldErrors`: React Hook Form 입력창 아래 표시
- `traceId`: Sonner 문의 코드와 Backend 로그 검색
- HTTP 상태: 재시도, 인증, 권한, 충돌 처리 판단

Sonner는 저장 성공이나 일시적인 오류를 알리는 데 사용합니다. 페이지 로딩 실패는 페이지 ErrorState, 필드 오류는 입력창 아래, 동시 수정은 추후 Dialog 확장 대상으로 구분합니다.

---

# 8. SQL 로그 확인

Backend 로컬 또는 Docker 로그에서 다음 두 종류를 확인합니다.

## MyBatis 실행 정보

```text
[MYBATIS] mapperId=com.example.devnote.document.DocumentMapper.selectDocumentList,
command=SELECT, resultCount=10, elapsedMs=12
```

## 실제 파라미터가 포함된 SQL

```text
[SQL] traceId=..., connectionId=2, category=statement, executionTime=9ms
SELECT ... WHERE document.document_title LIKE '%React%' LIMIT 10 OFFSET 0;
```

관련 파일:

```text
backend/src/main/java/com/example/devnote/common/logging/MyBatisExecutionLoggingInterceptor.java
backend/src/main/java/com/example/devnote/common/logging/P6SpySqlFormatter.java
backend/src/main/resources/spy.properties
```

P6Spy는 JDBC에 바인딩된 파라미터가 반영된 SQL을 보여줍니다. 운영에서는 비밀번호, 토큰, 개인정보가 포함된 파라미터를 마스킹하고 전체 SQL 로그를 제한해야 합니다.

---

# 9. DB 초기화

이 학습 프로젝트는 사용자가 요청한 대로 V1·V2·V3 형식의 버전형 마이그레이션 파일을 사용하지 않습니다.

```text
backend/src/main/resources
├── schema.sql   # 현재 전체 테이블 구조
└── data.sql     # 기본 연습 데이터
```

Docker 로컬 환경은 기존 연습용 MySQL Volume에 새 Entity 컬럼이 빠져 있어도 시작할 수 있도록 다음 값을 기본으로 사용합니다.

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: update
```

문서 조회와 저장 쿼리는 JPA Repository가 아니라 계속 MyBatis XML이 담당합니다. `update`는 로컬 연습 DB 구조 보정용이며 실제 운영 환경에서는 별도의 검증된 마이그레이션 절차와 `validate` 설정을 사용해야 합니다.

현재 테이블 구조와 기존 연습 DB가 크게 달라 충돌하면 다음 명령으로 볼륨을 초기화합니다.

```bash
docker compose down -v
docker compose up --build -d
```

---

# 10. 테스트 실행

## Backend

Testcontainers가 실제 MySQL 8.4 컨테이너를 사용하므로 Docker가 실행 중이어야 합니다.

### Windows

```cmd
cd backend
gradlew.bat test
```

### macOS / Linux

```bash
cd backend
./gradlew test
```

전체 검증:

```bash
./gradlew clean check
```

## Frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

테스트 감시 모드:

```bash
npm run test:watch
```

---

# 11. 주요 폴더 구조

```text
devnote-practice
├── compose.yml
├── compose.dev.yml
├── README.md
├── http
│   └── devnote-api.http
├── backend
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradle.properties
│   ├── gradlew
│   ├── gradlew.bat
│   ├── gradle/wrapper/gradle-wrapper.properties
│   ├── Dockerfile
│   └── src
└── frontend
    ├── package.json
    ├── Dockerfile
    ├── vite.config.ts
    └── src
```

Backend 기능 패키지:

```text
controller → HTTP 요청과 응답
service    → 업무 규칙과 트랜잭션
dao        → SqlSessionTemplate 호출
domain     → JPA Entity
dto        → 요청·응답·검색 조건
exception  → 기능별 업무 예외
```

Frontend 기능 패키지:

```text
pages      → 라우트 단위 화면
components → 재사용 UI
a​​pi       → Backend 호출 함수
hooks      → TanStack Query
styles     → 화면 스타일
mocks      → MSW 더미 응답
shared     → HTTP Client, 로그, 알림, 공통 타입
```

---

# 12. API 빠른 테스트

IntelliJ HTTP Client 또는 VS Code REST Client에서 다음 파일을 열 수 있습니다.

```text
http/devnote-api.http
```

Swagger UI에서도 직접 테스트할 수 있습니다.

```text
http://localhost:8080/swagger-ui.html
```

주요 API:

| Method | URL | 기능 |
|---|---|---|
| GET | `/api/v1/documents` | 목록·검색·페이징 |
| GET | `/api/v1/documents/{documentId}` | 상세 조회 |
| GET | `/api/v1/history` | 공개 업무 History 목록(슈퍼관리자는 임시글 포함) |
| GET | `/api/v1/history/{documentId}` | 공개 업무 History 상세 |
| POST | `/api/v1/history` | 슈퍼관리자 전용 업무 History 작성 |
| PUT/DELETE | `/api/v1/history/{documentId}` | 슈퍼관리자 전용 업무 History 수정·삭제 |
| POST | `/api/v1/documents` | 생성 |
| PUT | `/api/v1/documents/{documentId}` | 수정·버전 충돌 검사 |
| DELETE | `/api/v1/documents/{documentId}` | 소프트 삭제 |
| POST | `/api/v1/documents/{documentId}/restore` | 복구 |
| GET | `/api/v1/documents/{documentId}/histories` | 변경 이력 |
| POST | `/api/v1/files/attachments` | 첨부파일 업로드 |
| POST | `/api/v1/files/editor-images` | 에디터 이미지 업로드 |
| GET | `/api/v1/files/{fileId}/download` | 파일 다운로드 |
| GET | `/api/v1/files/{fileId}/content` | 이미지 등 브라우저 인라인 표시 |
| GET | `/api/v1/portfolio/sections` | 공개 또는 편집용 포트폴리오 섹션 목록 |
| POST | `/api/v1/portfolio/sections` | 포트폴리오 섹션 생성 |
| PUT | `/api/v1/portfolio/sections/{sectionId}` | 포트폴리오 섹션 수정 |
| DELETE | `/api/v1/portfolio/sections/{sectionId}` | 포트폴리오 섹션 소프트 삭제 |
| POST | `/api/v1/portfolio/editor-images` | 포트폴리오 이미지 업로드 |
| POST | `/api/v1/auth/login` | 로그인과 HttpOnly 세션 생성 |
| POST | `/api/v1/auth/register` | 일반 회원가입 |
| GET/DELETE | `/api/v1/auth/session` | 현재 로그인 조회·로그아웃 |
| GET/POST | `/api/v1/polls` | 투표 목록·로그인 회원 투표 생성 |
| PUT | `/api/v1/polls/{pollId}` | 작성자·관리자 진행 중 투표 수정 |
| POST | `/api/v1/polls/{pollId}/votes` | 비회원·회원 단일·복수 선택 투표 참여 |
| PUT | `/api/v1/polls/{pollId}/status` | 작성자·관리자 투표 종료·결과 공개 |
| DELETE | `/api/v1/polls/{pollId}` | 관리자·슈퍼관리자 투표 소프트 삭제 |
| POST | `/api/v1/utilities/regex/java` | Java `Pattern` 기반 정규식 찾기·전체 일치·치환 |
| GET/POST | `/api/v1/snippets` | 로그인 회원별 코드 조각 목록·생성 |
| GET/PUT/DELETE | `/api/v1/snippets/{snippetId}` | 소유 회원 코드 조각 조회·수정·소프트 삭제 |
| POST | `/api/v1/snippets/{snippetId}/restore` | 휴지통 코드 조각 복구 |
| POST | `/api/v1/snippets/bulk-delete` | 선택 코드 조각 일괄 소프트 삭제 |
| POST | `/api/v1/snippets/bulk-restore` | 선택 코드 조각 일괄 복구 |
| GET | `/api/v1/admin/members` | 관리자 회원 목록 조회 |
| PUT | `/api/v1/admin/members/{memberId}` | 슈퍼관리자 회원 등급·역할·상태 변경 |
| GET | `/api/v1/admin/grades` | 관리자 등급 목록 조회 |
| PUT | `/api/v1/admin/grades/{gradeCode}` | 슈퍼관리자 등급 기준 변경 |
| GET | `/api/v1/admin/permissions` | 관리자 역할별 권한 조회 |
| PUT | `/api/v1/admin/permissions/{role}/{permission}` | 슈퍼관리자 역할별 권한 변경 |
| GET | `/api/v1/admin/analytics` | 일간·월간 방문자, 페이지뷰와 최근 이용 이력 조회 |
| POST | `/api/v1/visits` | 세션 기반 페이지 방문 기록 |

포트폴리오 변경·이미지 업로드 요청은 슈퍼관리자 로그인 세션과 `X-Portfolio-Editor: true` 헤더가 모두 필요합니다. 브라우저 화면에서는 Axios·Fetch 공통 클라이언트가 이를 처리합니다.

---

# 13. 자주 발생하는 문제

## 3306 포트가 이미 사용 중

`.env`에서 변경합니다.

```env
MYSQL_PORT=3307
```

Docker Backend는 컨테이너 내부에서 `mysql:3306`으로 연결하므로 변경할 필요가 없습니다. 로컬 Spring Boot가 3307로 접속하려면 `DATABASE_URL`도 함께 변경해야 합니다.

## 8080 포트가 이미 사용 중

```env
BACKEND_PORT=8081
```

로컬 Vite Proxy를 사용할 경우 `vite.config.ts`의 target도 맞춰야 합니다.

## React에서 Backend 연결 실패

확인 순서:

```bash
docker compose ps
docker compose logs backend
curl http://localhost:8080/actuator/health
```

Vite 로컬 실행 시 Spring Boot가 8080에서 실행되는지 확인합니다.

## MSW가 시작되지 않음

```bash
cd frontend
npx msw init public --save
```

그리고:

```env
VITE_DATA_SOURCE=mock
```

Vite 서버를 다시 시작합니다.

## DB 초기화 또는 JPA 스키마 검증 실패

이미 적용된 마이그레이션 SQL을 수정했는지 확인합니다. 학습 DB를 초기화해도 되는 경우:

```bash
docker compose down -v
docker compose up --build -d
```

## 문서 수정 시 409

다른 요청이 먼저 문서를 수정하여 `versionNumber`가 바뀐 상황입니다. 상세 페이지를 새로고침한 뒤 다시 수정합니다. 브라우저 창 두 개로 의도적으로 재현할 수 있습니다.

## 파일 업로드 후 컨테이너 재시작

파일은 `devnote-file-storage` Docker Volume에 저장되므로 일반 재시작에는 유지됩니다. `docker compose down -v`를 실행하면 삭제됩니다.

## React 로그가 두 번 보임

개발 환경의 `React.StrictMode`가 Effect 정리와 순수성 문제를 찾기 위해 일부 코드를 추가 실행할 수 있습니다. 운영 빌드에서는 같은 방식으로 실행되지 않습니다. 단순히 Strict Mode를 제거하기 전에 Effect cleanup과 중복 요청 원인을 확인하세요.

---


## Docker 프론트 빌드에서 Vite 타입 충돌이 발생하는 경우

이 프로젝트의 초기 배포본에는 `vite@8.1.0`, `@vitejs/plugin-react@6.0.0`, `vitest@4.0.0` 조합이 들어 있었습니다. Vitest 4.0.0은 Vite 6·7 계열을 의존성 범위로 사용하므로, Vite 8의 Rolldown 타입과 Vitest 내부 Vite 7의 Rollup 타입이 동시에 설치되면 `Plugin<any>[] is not assignable to PluginOption` 오류가 발생할 수 있습니다.

수정본에서는 다음처럼 호환 버전을 고정했습니다.

```text
Vite                  7.1.12
@vitejs/plugin-react   5.0.0
Vitest                 4.0.0
Node.js                22.12 이상
```

또한 설정 파일의 책임을 분리했습니다.

```text
vite.config.ts      개발 서버와 운영 빌드 설정
vitest.config.ts    단위·컴포넌트 테스트 설정
```

이전 이미지와 npm 설치 레이어를 완전히 제거한 뒤 다시 빌드합니다.

```bash
docker compose down
docker compose build --no-cache frontend
docker compose up -d
docker compose logs -f frontend
```

전체 이미지를 다시 빌드하려면 다음 명령을 사용합니다.

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

# 14. 초보자 학습 순서

1. `/react`에서 14단계 난이도와 오류 실험실을 확인합니다.
2. 각 화면에서 생성·조회·수정·삭제를 모두 실행합니다.
3. 오른쪽 상단 `?` 아이콘에서 사용 방법과 학습 내용을 읽습니다.
4. 할 일 → 연락처 → 상품 모달 순서로 로컬 상태와 폼을 익힙니다.
5. 검색 자동완성에서 Effect cleanup, debounce, 요청 취소와 키보드 조작을 확인합니다.
6. 일반 게시판 → 이미지 → 댓글 → 예약으로 데이터 구조와 업무 규칙을 확장합니다.
7. 업무 관리에서 TanStack Query와 낙관적 업데이트를 확인합니다.
8. 문의·카테고리에서 권한과 재귀 트리를 익힙니다.
9. 문서 화면에서 더미 데이터 ON으로 MSW API를 연습합니다.
10. 더미 데이터 OFF로 Spring Boot·MyBatis·MySQL 실제 흐름을 확인합니다.
11. Backend 로그에서 같은 `traceId`, mapper ID와 P6Spy SQL을 찾습니다.
12. 관리자 화면에서 다중 선택과 Soft Delete·복구를 실행합니다.
13. 오류 시나리오에서 401·409·500·지연·네트워크 오류를 확인합니다.
14. Frontend·Backend 테스트와 정적 검사를 실행합니다.

각 화면 오른쪽 위의 `?` 학습 가이드에서 사용법, 소스 흐름과 확장 과제를 확인할 수 있습니다.

---

# 15. 후속 확장 실습

현재 실행 버전은 문서·에디터·파일·검색·예외·로그의 핵심 흐름을 포함합니다. 아래 기능은 현재 프로젝트를 바탕으로 기능 단위로 확장하기 좋습니다.

- Spring Security JWT 또는 세션 로그인
- Refresh Token 재사용 방지
- 태그와 다중 카테고리 서버 연동
- 즐겨찾기 실제 API와 낙관적 업데이트
- 문서 이력 비교·복구 UI
- 자동저장과 IndexedDB 임시본
- Cursor Pagination과 무한 스크롤
- 10,000건 가상 스크롤
- CSV·Excel 가져오기와 내보내기
- Redis 또는 Caffeine 캐시
- SSE 진행률
- WebSocket 알림
- OpenTelemetry, Prometheus, Grafana
- ArchUnit 또는 Spring Modulith
- OpenAPI 기반 TypeScript 자동 생성
- HTML Sanitizing과 파일 시그니처 검사

기능을 한꺼번에 추가하기보다 각각 정상, 오류, 권한, 동시성, 대량 데이터, 테스트, 로그까지 완성한 뒤 다음 기능으로 넘어가는 방식을 권장합니다.

---

# 16. 버전 선택 이유

- Java 21: LTS 버전
- Gradle 8.14.4: Java 21 백엔드 빌드 도구
- Spring Boot 3.5.16: Spring Boot 3 계열의 안정된 유지보수 버전
- MyBatis Spring Boot Starter 3.0.5: Spring Boot 3.2~3.5 호환 계열
- MySQL 8.4: LTS 계열
- React 19.2.7
- Vite 7.1.12
- @vitejs/plugin-react 5.0.0
- Vitest 4.0.0
- Node.js 22 계열

의존성은 학습 프로젝트가 갑자기 깨지지 않도록 `package.json`과 `build.gradle`에서 명시적으로 고정했습니다. 실제 팀 프로젝트에서는 Dependabot 또는 Renovate와 CI를 통해 정기적으로 업데이트합니다.
---

# 17. 산출물 검증 상태

프로젝트 실행 전후에는 이 README의 Docker 실행, 로그 확인, 테스트 실행 절차를 따라 상태를 확인하세요.

검증 결과는 변경 시점의 실행 환경에 따라 달라질 수 있으므로, 위의 Frontend·Backend 명령과 Docker 상태 확인을 함께 실행합니다. 의존성, Docker 또는 네트워크 제한으로 일부 검사를 실행하지 못했다면 해당 제한을 작업 결과에 기록합니다.
