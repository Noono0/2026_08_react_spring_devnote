# 기능과 학습 가이드

[문서 목록으로](../README.md)

## 난이도별 CRUD 학습 로드맵

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
| 13 | `/react/admin-users` | 9/10 | 관리자 사용자 CRUD | 다중 선택, 일괄 역할·상태 변경, Soft Delete·복구 | React State |
| 14 | `/react/documents` | 9.5/10 | 문서·에디터·이미지 CRUD | Axios/Fetch, MSW, Tiptap, 파일, MyBatis | Spring Boot + MySQL 또는 MSW |
| 15 | `/react/infinite-feed` | 7.5/10 | 무한 스크롤 피드 | `useInfiniteQuery`, 커서 페이지네이션, IntersectionObserver | 비동기 로컬 API |
| 16 | `/react/dynamic-form` | 8/10 | 동적 견적서 폼 | `useFieldArray`, `useWatch`, Zod 배열 검증 | React Hook Form |
| 17 | `/react/context-auth` | 8.5/10 | Context 로그인·보호 라우트 | `createContext`, 커스텀 훅, 중첩·보호 라우트 | React Context |
| 18 | `/react/react19-actions` | 9/10 | React 19 Actions 방명록 | `useActionState`, `useFormStatus`, `useOptimistic` | 비동기 로컬 API |
| 19 | `/react/custom-hooks` | 8/10 | 읽을거리 메모장 | 커스텀 훅, `useSyncExternalStore`, 디바운스, 저장값 검증 | localStorage |
| 20 | `/react/performance` | 9/10 | 상품 2,000개 목록 측정 | `Profiler`, `memo`·`useCallback`, `useDeferredValue` | React State |
| 21 | `/react/zustand` | 8/10 | 장바구니 전역 상태 | Zustand selector, `persist`, 저장값 Zod 검증 | Zustand + localStorage |
| 22 | `/react/url-state` | 8/10 | 검색·필터·페이지 주소 저장 | `useSearchParams`, 주소 값 검증, push·replace | URL |
| 23 | `/react/refs-focus` | 8/10 | 회의 안건 포커스·스크롤 | `useRef`, ref prop(React 19), 콜백 ref 정리 함수 | React State |
| 24 | `/react/use-suspense` | 9/10 | 공지 목록 | `use()`, Suspense, Error Boundary, Promise 캐시 | 비동기 로컬 API |
| 25 | `/react/testing` | 8.5/10 | 주문 금액 계산기 테스트 | Vitest, Testing Library, 순수 함수·경계값 테스트 | React State |
| 실험실 | `/react/development/scenarios` | 10/10 | 오류·네트워크 실험 | 지연, 빈 결과, 401, 409, 500, 네트워크 오류 | MSW |

로드맵은 두 과정으로 나뉩니다.

- **기본 과정(1~14단계)**: 뒤 단계로 갈수록 난이도가 낮아지지 않도록 배치했습니다. 13단계까지는 브라우저 안의 상태와 로컬 비동기 API만 사용하고, 14단계 문서 CRUD에서 처음으로 실제 Spring Boot·MyBatis·MySQL에 연결해 기본 과정을 마칩니다. `learningGuides.test.ts`가 이 순서를 검사합니다.
- **심화 과정(15~25단계)**: 기본 과정을 마친 뒤 무한 스크롤·동적 폼·Context·React 19·커스텀 훅·성능·전역 상태·URL 상태·포커스·Suspense·테스트를 주제별로 다룹니다. 앞 단계의 개념을 이어 쓰는 순서이므로 난이도 점수는 주제에 따라 오르내립니다.

### 직접 해 보기 (사이트 안 편집기 · StackBlitz · Codespaces)

1~25단계 화면 제목 옆의 `▶ 직접 해 보기`에서 설치 없이 연습하는 방법을 고릅니다. 어느 방법이든 고친 내용은 실제 사이트와 저장소에 반영되지 않습니다.

| 선택 | 실행 범위 | 특징 |
|---|---|---|
| 이 화면 아래에서 바로 편집 (Sandpack) | 단계 핵심만 담은 연습 예제 | 사이트를 떠나지 않고 연습 화면 맨 아래 `N단계 직접 해 보기` 영역이 펼쳐지며 편집기·미리보기·콘솔이 나옵니다. 메뉴 없이 그 영역의 제목 버튼으로 바로 펼치고 접을 수도 있습니다(넓은 화면은 좌우, 760px 이하는 위아래 배치). 예제는 `frontend/src/features/curriculum/sandbox/examples/`의 25개 파일이고, 파일 맨 위 주석의 `해 볼 것`부터 시작합니다. 도구 막대의 `색 테마`(사이트 테마 따라가기·밝게·어둡게·베이지·남색 밤)로 편집기와 미리보기의 배경·글자 색을 함께 바꿀 수 있고, 고른 테마는 브라우저에 저장됩니다. 넓은 화면에서는 펼친 상자 오른쪽 아래 모서리(◢)를 끌어 상자 전체의 너비(본문 폭 이하)와 높이를 함께 바꿀 수 있고, 본문 폭까지 넓히면 기본값(본문 폭 전체)으로 돌아갑니다. 본문보다 넓게 쓰려면 상자 제목 줄 오른쪽 `크게 보기`를 누르면 브라우저 창 전체(사이드바 위까지)를 덮고, 다시 누르거나 `Esc`(코드 편집기 밖에서)·접기로 원래 자리로 돌아옵니다. 또 편집기·미리보기 사이 세로 막대(⋮)로 좌우 비율(20~80%)을, 아래 가로 막대(⋯)로 높이(320~1000px)를 끌어서 바꿀 수 있습니다. 막대에 포커스를 두고 방향키로도 조절되며(`Shift`는 크게), 더블클릭하면 기본 크기로 돌아갑니다. 조절한 크기도 브라우저에 저장됩니다. `처음 코드로 되돌리기`로 원래 예제로 돌아가며, 영역을 접거나 다른 화면으로 가면 고친 내용은 사라집니다. 번들링은 CodeSandbox 서버가 하므로 인터넷이 필요합니다. |
| StackBlitz에서 실제 코드 열기 | 실제 `frontend/` 전체 | 로그인 불필요. `pnpm run dev:online`(`.env.online`, 더미 데이터 MSW)으로 시작하고 해당 단계 파일(`file=`)과 화면(`initialPath=`)을 바로 엽니다. GitHub의 `main` 브랜치를 엽니다. |
| Codespaces에서 전체 실행 | 저장소 전체(React + Spring Boot + MySQL) | GitHub 로그인 필요. `.devcontainer/devcontainer.json`이 JDK 21·Node 22·Docker를 준비하고, 열린 뒤 터미널에서 `bash scripts/start-codespace.sh`를 실행하면 MySQL → 백엔드 → 프론트엔드 순서로 켜집니다. |

- 사이트 안 편집기 예제는 실제 `.tsx` 파일이라 `tsc`·ESLint가 함께 검사하고, `stageSandboxes.test.ts`가 25단계 모두 예제가 있는지와 예제가 쓰는 패키지가 `sandboxSetup.ts`의 의존성 목록에 있는지 확인합니다. 의존성 버전은 `frontend/package.json`과 맞춥니다.
- Sandpack(`@codesandbox/sandpack-react`)과 예제 원문은 아래 영역을 펼칠 때만 내려받는 별도 묶음(`StageSandboxPanel`)입니다. 펼침 상태는 `curriculum/state/stageSandboxStore.ts`(Zustand)가 제목 옆 메뉴와 아래 영역(`StageSandboxSection`, `ApplicationLayout`에서 렌더링) 사이에 공유합니다. 첫 화면 크기에는 영향이 없습니다.

#### Codespaces 선택지 끄기·지우기

- **메뉴에서만 숨기기**: `frontend/src/features/curriculum/data/onlinePracticeLinks.ts`의 `SHOW_CODESPACES_OPTION`을 `false`로 바꿉니다.
- **완전히 지우기**: 코드에서 `[CODESPACES]` 표시가 붙은 블록(`OnlinePracticeMenu.tsx`, `onlinePracticeLinks.ts`)을 지우고, `.devcontainer/`와 `scripts/start-codespace.sh`, 이 문서의 Codespaces 행을 지운 뒤 `LearningGuideTitle.test.tsx`·`onlinePracticeLinks.test.ts`의 Codespaces 확인을 함께 정리합니다.

### 화면별 학습 가이드 아이콘

모든 화면 오른쪽 상단에 `?` 아이콘이 있습니다. 누르면 현재 화면 전용 학습 가이드 모달이 열립니다.

내용이 긴 학습 가이드·유틸리티 도움말·에디터·API 작업 모달은 데스크톱에서 오른쪽 아래 `◢` 핸들을 드래그해 가로·세로 크기를 조절할 수 있습니다. 핸들에 포커스를 두고 방향키를 눌러도 조절되며, `Shift + 방향키`는 더 크게 변경합니다. 조절한 크기는 브라우저에 저장되고 핸들을 더블클릭하면 기본 크기로 초기화됩니다. 모바일에서는 화면에 맞춘 반응형 모달을 사용합니다.

가이드 모달 탭:

- **사용 방법**: 실제 버튼을 누르는 순서와 자주 발생하는 실수
- **학습 내용**: 이번 화면에서 배우는 React·CRUD 개념과 관련 파일
- **소스 흐름**: 이벤트부터 상태·API·백엔드까지의 실행 순서
- **실습 과제**: 기본·응용 기능을 직접 확장하는 과제. 과제마다 완료 체크박스와 접힌 `힌트 보기`(어느 파일의 어느 함수부터 보면 되는지)가 있습니다.

로드맵 카드의 `완료 표시`나 가이드 대화상자 아래의 `이 단계 완료로 표시`로 끝낸 단계를 기록하면, 로드맵 위쪽에 `N / 25단계 완료` 진행률이 표시됩니다. 진도와 과제 체크는 서버가 아니라 이 브라우저의 `localStorage`(`learningProgress`)에 저장되며, 다시 읽을 때 Zod로 검증합니다(`features/curriculum/state/learningProgressStore.ts`).

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

## 공통 화면 기능

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
- 페이지 오류 화면(`PageErrorBoundary`): 한 화면이 렌더링 중 실패해도 메뉴는 남기고 새로고침·다시 시도를 안내합니다. 재배포 뒤 열려 있던 탭에서 옛 화면 파일을 못 찾으면 "새 버전이 배포되었습니다"로 구분해 안내하고, 다른 메뉴로 이동하면 오류 상태가 지워집니다.
- 초보자가 흐름을 확인할 수 있는 개발 로그

## 더미 데이터 ON/OFF

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

할 일·연락처·상품·검색·일반 게시판·갤러리·댓글·예약·문의·카테고리·관리자 화면은 **React 상태와 사용자 상호작용 패턴 자체를 학습하기 위한 독립 실습 화면**입니다. 실제 REST·MyBatis·MySQL 연결은 14단계 문서 CRUD에서 학습합니다.

### 14단계 문서 CRUD와 업무 History의 코드 위치

14단계 학습 화면(`/react/documents`)과 포트폴리오의 업무 History(`/history`)는 백엔드에서 같은 `documents` 테이블을 범위(`PRACTICE`·`HISTORY`)로 나눠 쓰고, 응답 모양도 같습니다. 그래도 프론트엔드 코드는 서로 공유하지 않습니다. 학습자가 14단계 코드를 고치며 실습해도 실제 포트폴리오 화면이 바뀌지 않게 하기 위해서입니다.

| 위치 | 담당 | 비고 |
|---|---|---|
| `frontend/src/features/practice/14-documents/` | 14단계 학습 화면 | `/api/v1/documents`만 호출, 캐시 키 `["documents", …]` |
| `frontend/src/features/history/` | 포트폴리오 업무 History | `/api/v1/history`만 호출, 캐시 키 `["history", …]`, 슈퍼관리자만 편집 |
| `frontend/src/features/rich-text-editor/` | Tiptap 리치 텍스트 에디터 | 14단계·업무 History·포트폴리오 블록 편집기가 함께 사용 |
| `frontend/src/shared/ui/Pagination.tsx` | 페이지 번호 버튼 | 14단계·업무 History·Snippet·투표 목록이 함께 사용 |

두 화면을 나란히 열어 보면 같은 API 모양에 서로 다른 권한 규칙(방문자는 발행 글만, 슈퍼관리자만 작성)을 적용하는 방법을 비교할 수 있습니다. 로그인·로그아웃 시에는 `useAuthSession.ts`가 두 캐시를 모두 무효화합니다.

## 현재 포함된 React 기능

- React 19 + TypeScript strict + Vite
- 난이도별 25개 React 학습 단계와 개발 오류 실험실
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
- Spring Boot 문서 목록·상세·생성·수정·삭제(14단계)
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

## Spring Boot 기능

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

## API Workspace

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

## JSON ↔ CSV Converter

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

## 토픽 투표

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

## 개발 유틸리티 전체 목록

유틸리티 홈과 통합 왼쪽 사이드 메뉴에서 아래 화면으로 이동할 수 있습니다. 큰 입력 도구는 React `lazy`와 `Suspense`로 분리해 첫 화면 번들에 한꺼번에 포함하지 않습니다.

| 경로 | 화면 | 주요 기능 | 처리·저장 위치 |
|---|---|---|---|
| `/utilities/api-workspace` | API Workspace | HTTP 요청, 응답 분석, History, Collection·Folder·Saved Request, Environment, Collection Runner·매일 예약, Postman v2.1·cURL 공유, 코드 생성 | 브라우저 실행·회원별 로컬 저장 |
| `/utilities/crawler` | 웹 크롤링 도구 | 설정 게시판 CRUD, Playwright 폼·세션 로그인, 실행 성공·실패 이력, 사이트 검색·iframe 추출, AND/OR 키워드 그룹, 결과 재검색·CSV | Spring의 격리 Chromium 실행, 설정·이력은 MySQL 저장, 계정정보는 브라우저 또는 세션 파일에만 저장 |
| `/utilities/regex` | Regex Tester | JavaScript·Java 실제 엔진, 찾기·전체 일치·치환, 그룹, 초보자 설명 | JS는 브라우저, Java는 Spring API, 저장 안 함 |
| `/utilities/formatter` | Code Formatter | JSON·JS·TS·CSS·HTML·SQL·Markdown 정리와 Minify | 브라우저, 저장 안 함 |
| `/utilities/sql-formatter` | SQL Formatter | dpriver식 SQL 정리, 대소문자·쉼표·목록 옵션, 코멘트 주석, Java 출력 | 브라우저, 저장 안 함 |
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

### 웹 크롤링 도구

실행 방식·로그인 세션·매크로·수동 확인은 [크롤러 사용 안내](crawler.md)를 참고하세요.

### Regex Tester

- JavaScript는 브라우저 `RegExp`, Java는 `/api/v1/utilities/regex/java`에서 `Pattern`과 `Matcher`를 실제로 실행합니다.
- 입력은 100,000자, 결과는 200개로 제한하고 Java 실행은 1초 뒤 취소합니다.
- 중첩 수량자처럼 ReDoS 가능성이 큰 표현에는 실행 전 경고 또는 거부를 적용합니다.
- 패턴과 테스트 문자열은 DB, URL, 브라우저 저장소, 애플리케이션 로그에 저장하지 않습니다.
- 초보자 설명과 JavaScript 리터럴·생성자·Java Pattern 코드 복사는 학습 보조이며, 모든 엔진 고급 문법을 자동 해석한다고 가정하지 않습니다.

### Formatter·Converter·Diff·JWT·Markdown

- Code Formatter는 JSON을 실제 파서로 검증합니다. 다른 언어는 의존성을 늘리지 않은 경량 학습용 구현이므로 복잡한 JSX·Template Literal·SQL dialect 전체 AST를 지원하지 않습니다.
- Code Formatter·SQL Formatter의 입력·결과는 문법 색(키워드·문자열·주석·숫자·태그·속성)을 입혀 보여 줍니다. textarea는 글자마다 색을 줄 수 없어, 색칠한 `<pre>` 위에 글자만 투명한 textarea를 같은 글꼴·여백으로 포개고 스크롤을 맞춥니다(`shared/ui/HighlightedTextarea.tsx`). 색 조각은 `shared/lib/syntaxHighlighter.ts`가 만들며 Markdown 미리보기 코드 블록도 같은 색칠기를 씁니다. 같은 부품으로 Markdown Editor·Data Converter·JSONPath·JWT·API Workspace·OpenAPI·Mock API·WebSocket·SQL Schema·Dependency·Snippet 등 코드·데이터 입력·결과에도 색을 넣었습니다(일반 글·로그·CSV는 제외). 색은 `--syntax-*` CSS 변수로 라이트(진한 색)·다크(밝은 색) 테마를 따로 정합니다. 줄바꿈 위치가 어긋나지 않게 자동 줄바꿈 없이 가로 스크롤로 둡니다.
- SQL Formatter(`/utilities/sql-formatter`)는 dpriver Instant SQL Formatter의 기본 기능을 따릅니다. 기본 `키워드 정렬`은 SELECT·FROM·WHERE를 7칸에 맞춰 내용을 한 열로 세우고(AS 별칭 열 맞춤, JOIN 7칸·ON 14칸, AND/OR 오른쪽 맞춤, CASE는 WHEN·ELSE마다, 서브쿼리는 "(" 다음 열에서 다시 정리, INSERT 칼럼·VALUES는 한 줄에 하나), `들여쓰기 칸 수`를 고르면 키워드 아래로 `−`/`+` 1~10칸 들입니다. 키워드·함수·테이블/칼럼 이름 대소문자, 쉼표 위치(뒤·앞·앞+공백), 목록 한 줄에 하나, AS 별칭 열 맞춤, AND/OR를 WHERE 아래에, 출력 형식(SQL·Java 문자열·Java StringBuilder)을 고를 수 있고, `결과를 입력으로`를 지원합니다. 입력칸에 쓰거나 옵션·결과 방식(정리/한 줄로 압축)을 바꾸면 버튼 없이 결과가 바로 다시 정리됩니다(결과를 State에 두지 않고 지금 입력과 옵션으로 계산, 긴 입력은 `useDeferredValue`로 입력이 먼저 반응). Code Formatter도 같은 방식으로 입력하면 바로 정리·압축합니다. Code Formatter의 SQL은 같은 엔진의 기본값을 쓰고 키워드 대·소문자만 고릅니다.
- SQL Formatter의 `테이블·칼럼 코멘트`에 `users 유저테이블`, `users.id 유저아이디`, `orders_count 유저수`(AS 별칭) 같은 줄이나 DB 도구의 탭 3칸(테이블 ⇥ 칼럼 ⇥ 코멘트), MySQL `CREATE TABLE ... COMMENT`, `COMMENT ON ... IS`를 넣으면 SELECT 칼럼·FROM/JOIN 테이블·UPDATE SET 칼럼 줄 끝에 주석을 한 열로 맞춰 붙입니다. `u.id`는 FROM/JOIN 별칭(`users u`)으로, 서브쿼리 칼럼은 서브쿼리의 별칭으로 테이블을 찾고, AS 별칭 코멘트가 있으면 먼저 씁니다. 주석 형식은 쿼리를 바로 실행할 때 `SQL (--)`, MyBatis XML에 넣을 때 `MyBatis (/* */)`를 고릅니다(줄이 합쳐지면 `--` 뒤가 모두 주석이 될 수 있음). 원래 있던 주석은 그대로 두어 다시 정리해도 중복되지 않습니다. 구현은 `features/utility/utils/sqlTokenizer.ts`·`sqlCommentDictionary.ts`·`sqlFormatter.ts`·`sqlCodeOutput.ts`, 화면은 `pages/SqlFormatterPage.tsx`입니다.
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
  → /react/admin-users
  → /react/documents?viewMode=table
  → /react/documents?viewMode=thumbnail
  → /react/infinite-feed
  → /react/dynamic-form
  → /react/context-auth
  → /react/react19-actions
  → /react/development/scenarios
```

## 초보자 학습 순서

1. `/react`에서 25단계 난이도와 오류 실험실을 확인합니다.
2. 각 화면에서 생성·조회·수정·삭제를 모두 실행합니다.
3. 오른쪽 상단 `?` 아이콘에서 사용 방법과 학습 내용을 읽습니다.
4. 할 일 → 연락처 → 상품 모달 순서로 로컬 상태와 폼을 익힙니다.
5. 검색 자동완성에서 Effect cleanup, debounce, 요청 취소와 키보드 조작을 확인합니다.
6. 일반 게시판 → 이미지 → 댓글 → 예약으로 데이터 구조와 업무 규칙을 확장합니다.
7. 업무 관리에서 TanStack Query와 낙관적 업데이트를 확인합니다.
8. 문의·카테고리에서 권한과 재귀 트리를 익힙니다.
9. 관리자 화면(13단계)에서 다중 선택과 Soft Delete·복구를 실행합니다.
10. 문서 화면(14단계)에서 더미 데이터 ON으로 MSW API를 연습합니다.
11. 더미 데이터 OFF로 Spring Boot·MyBatis·MySQL 실제 흐름을 확인합니다.
12. Backend 로그에서 같은 `traceId`, mapper ID와 P6Spy SQL을 찾습니다.
13. 심화 단계에서 무한 스크롤(15) → 동적 폼(16) → Context 보호 라우트(17) → React 19 Actions(18)를 익힙니다. 18단계는 10단계 업무 관리의 TanStack Query 낙관적 업데이트와 비교해 봅니다.
    이어서 커스텀 훅(19) → 성능 측정(20) → Zustand(21) → URL 상태(22) → ref·포커스(23) → `use()`·Suspense(24) → 테스트 작성(25)으로 실무 주제를 다룹니다.
14. 오류 시나리오에서 401·409·500·지연·네트워크 오류를 확인합니다.
15. Frontend·Backend 테스트와 정적 검사를 실행합니다.

각 화면 오른쪽 위의 `?` 학습 가이드에서 사용법, 소스 흐름과 확장 과제를 확인할 수 있습니다.

---

## 후속 확장 실습

현재 실행 버전은 문서·에디터·파일·검색·예외·로그의 핵심 흐름을 포함합니다. 아래 기능은 현재 프로젝트를 바탕으로 기능 단위로 확장하기 좋습니다.

- 기존 세션 로그인과 JWT 인증 방식 비교 실습
- Refresh Token 재사용 방지
- 태그와 다중 카테고리 서버 연동
- 즐겨찾기 실제 API와 낙관적 업데이트
- 문서 이력 비교·복구 UI
- 자동저장과 IndexedDB 임시본
- Cursor Pagination과 무한 스크롤
- 10,000건 가상 스크롤
- 기존 JSON·CSV 변환에 Excel 파일 가져오기·내보내기 추가
- Redis 또는 Caffeine 캐시
- SSE 진행률
- WebSocket 알림
- OpenTelemetry, Prometheus, Grafana
- ArchUnit 또는 Spring Modulith
- OpenAPI 기반 TypeScript 자동 생성
- 기존 HTML 정화·파일 시그니처 검사의 허용 정책 확장

기능을 한꺼번에 추가하기보다 각각 정상, 오류, 권한, 동시성, 대량 데이터, 테스트, 로그까지 완성한 뒤 다음 기능으로 넘어가는 방식을 권장합니다.

---
