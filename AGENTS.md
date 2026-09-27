# AGENTS.md

## 문서 사용 원칙 / Document convention

- 모든 규칙은 한국어와 영어를 함께 적으며, 의미가 다를 경우 한국어를 기준으로 한다.
  Write every rule in Korean and English. If the meanings differ, the Korean version is authoritative.

## 프로젝트 목적 / Project purpose

- 이 저장소는 Spring Boot, MyBatis, MySQL을 백엔드로 사용하는 React 학습 프로젝트다.
  This repository is a React learning project backed by Spring Boot, MyBatis, and MySQL.
- 대규모 운영 환경용 추상화보다 학습 가치, 가독성, 코드 흐름의 추적 가능성을 우선한다.
  Prioritize learning value, readability, and traceability over production-scale abstraction.
- 기본 로컬 상태 CRUD부터 실제 API 기반 문서 CRUD까지 이어지는 단계별 학습 흐름을 유지한다.
  Preserve the staged learning flow from basic local-state CRUD to API-backed document CRUD.
- 주변 코드에서 영어가 필요한 경우를 제외하고 사용자 화면 문구와 학습 설명은 한국어로 작성한다.
  Write user-facing text and learning explanations in Korean unless the surrounding code requires English.

## 저장소 구조 / Repository layout

- `frontend/`: React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, MSW, React Hook Form, Zod 영역이다.
  `frontend/` contains React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, MSW, React Hook Form, and Zod.
- `backend/`: Java 21, Spring Boot, Gradle, MyBatis, MySQL 영역이다.
  `backend/` contains Java 21, Spring Boot, Gradle, MyBatis, and MySQL.
- `http/`: 수동 API 요청 예제를 보관한다.
  `http/` contains manual API request examples.
- `scripts/`: 저장소 검증 도구를 보관한다.
  `scripts/` contains repository verification utilities.
- `README.md`는 빠른 시작과 문서 색인, `docs/`는 실행·학습·크롤러·검증·유지보수 상세 안내를 제공한다.
  `README.md` provides quick-start instructions and a document index; `docs/` contains setup, learning, crawler, verification, and maintenance guides.

## 작업 원칙 / Working rules

- 수정하기 전에 관련 구현과 기존 패턴을 먼저 확인한다.
  Inspect the relevant implementation and existing patterns before editing.
- 요청받은 작업에만 집중하고 사용자의 관련 없는 변경 사항은 보존한다.
  Keep changes focused on the requested task and preserve unrelated user changes.
- 연습 중인 React 또는 백엔드 개념을 명확히 보여주는 가장 작고 이해하기 쉬운 구현을 우선한다.
  Prefer the smallest clear implementation that demonstrates the React or backend concept being practiced.
- 운영 의존성을 추가하기 전에 필요성을 설명하고 사용자 승인을 받는다.
  Explain why a new production dependency is needed and get user approval before adding it.
- 광범위한 타입 단언, `any`, 린트 규칙 비활성화, 빈 오류 처리로 실패를 숨기지 않는다.
  Do not hide failures with broad type assertions, `any`, disabled lint rules, or empty error handling.
- 동작 변경으로 기존 설명이 부정확해지면 관련 학습 가이드 또는 README도 함께 수정한다.
  Update the related learning guide or README when a behavior change makes existing documentation inaccurate.
- `frontend/dist/`와 Gradle 빌드 결과물 같은 생성 파일은 직접 수정하지 않는다.
  Do not modify generated files such as `frontend/dist/` or Gradle build output.

## 프론트엔드 규칙 / Frontend conventions

- TypeScript strict 설정을 유지하고 프로젝트의 `@/` import 별칭을 사용한다.
  Keep TypeScript strict and follow the project's `@/` import alias.
- 상태는 불변성을 지켜 갱신하고 React 상태 배열이나 객체를 직접 변경하지 않는다.
  Use immutable state updates and do not mutate React state arrays or objects in place.
- 로컬 UI 상태와 서버 상태를 구분하고 비동기 서버 상태에는 TanStack Query를 사용한다.
  Separate local UI state from server state and use TanStack Query for asynchronous server state.
- 중복 구현 전에 기존 공통 API, 알림, 로깅, 모달, 확인창 유틸리티를 재사용한다.
  Reuse shared API, notification, logging, modal, and confirmation utilities before creating duplicates.
- 필요한 화면에는 로딩, 빈 결과, 오류, 성공, 비활성 또는 처리 중 상태를 구현한다.
  Include loading, empty, error, success, and disabled or pending states where relevant.
- UI를 변경할 때 접근 가능한 라벨, 키보드 동작, 포커스 처리, 시맨틱 HTML을 유지한다.
  Preserve accessible labels, keyboard behavior, focus handling, and semantic HTML when changing UI.
- 초급 예제는 따라가기 쉽게 유지한다. 단순히 줄 수를 줄이기 위해서가 아니라 페이지에 독립적인 책임이 여러 개 있을 때 컴포넌트나 훅을 분리한다.
  Keep beginner examples easy to follow. Extract components or hooks when a page has multiple independent responsibilities, not merely to reduce line count.
- `useMemo`, `useCallback`, `memo`는 효과를 설명할 수 있을 때만 사용하고 성급하게 적용하지 않는다.
  Avoid premature `useMemo`, `useCallback`, or `memo`; use them only when their benefit is demonstrable.
- 신뢰할 수 없는 API, 저장소, URL, 폼 데이터는 적절한 경계에서 검증한다.
  Validate untrusted API, storage, URL, and form data at an appropriate boundary.
- 의미 있는 동작을 변경하면 Vitest와 Testing Library 테스트를 추가하거나 수정한다.
  Add or update Vitest and Testing Library tests for meaningful behavior changes.

## 백엔드 규칙 / Backend conventions

- 프로젝트의 Controller -> Service -> DAO -> MyBatis Mapper 흐름을 유지한다.
  Preserve the Controller -> Service -> DAO -> MyBatis Mapper flow used by the project.
- 비즈니스 규칙은 Service 계층에 두고 영속성 세부 구현은 DAO와 Mapper 계층에 둔다.
  Keep business rules in the service layer and persistence details in the DAO and mapper layers.
- 기존 API 응답 및 예외 처리 규칙을 사용한다.
  Follow the existing API response and exception-handling conventions.
- DTO 검증과 오류 코드를 명시적으로 작성한다.
  Keep DTO validation and error codes explicit.
- 관련된 비즈니스 규칙, 권한, 버전 충돌, 영속성 동작을 변경하면 테스트를 추가하거나 수정한다.
  Add or update tests for relevant business rules, authorization, version conflicts, and persistence behavior.
- 스키마, 초기 데이터, Mapper XML, DTO, Java 타입을 서로 일치시킨다.
  Keep the schema, seed data, mapper XML, DTOs, and Java types synchronized.

## 검증 / Verification

- 프론트엔드 변경 시 의존성을 사용할 수 있다면 `frontend/`에서 다음 명령을 실행한다.
  For frontend changes, run the following commands from `frontend/` when dependencies are available:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- 백엔드 변경 시 `backend/`에서 운영체제에 맞는 테스트 명령을 실행한다.
  For backend changes, run the appropriate test command from `backend/`:
  - Windows: `gradlew.bat test`
  - macOS/Linux: `./gradlew test`
- 프로젝트 전체 또는 설정을 변경하면 저장소 루트에서 관련 정적 검증 스크립트도 실행한다.
  For cross-project or configuration changes, also run the relevant static verification script from the repository root.
- 의존성, Docker, Java, Node.js, 권한, 네트워크 문제로 명령을 실행할 수 없다면 제한 사항을 분명하게 보고하고 검증에 성공했다고 말하지 않는다.
  If a command cannot run because dependencies, Docker, Java, Node.js, permissions, or network access are unavailable, report the limitation clearly and do not claim verification succeeded.

## 리뷰 체크리스트 / Review checklist

- CRUD 흐름과 React 상태 전이의 회귀 문제를 확인한다.
  Check for regressions in CRUD flows and React state transitions.
- 오래된 클로저, 누락된 Effect 정리, 불안정한 목록 key, 안전하지 않은 저장 데이터 파싱, Mutation 롤백을 확인한다.
  Check stale closures, missing effect cleanup, unstable list keys, unsafe storage parsing, and mutation rollback behavior.
- 로딩, 오류, 빈 결과, 라우트 매개변수 검증, 접근성, 모바일 레이아웃을 확인한다.
  Check loading, error, and empty states, route parameter validation, accessibility, and mobile layout.
- 프론트엔드, Controller, DTO, Service, DAO, Mapper 사이의 API 계약 불일치를 확인한다.
  Check API contract mismatches between the frontend, controller, DTO, service, DAO, and mapper.
- 리뷰 결과에서 확인된 결함과 선택적인 개선 사항을 구분한다.
  Distinguish confirmed defects from optional improvements in review results.

## 소통 / Communication

- 결과를 먼저 설명하고 중요한 구현 세부 사항을 그다음에 전달한다.
  Explain the outcome first, followed by the important implementation details.
- 학습용 변경에서는 어떤 개념을 보여주는지와 학습자가 무엇을 확인해야 하는지 간단히 설명한다.
  For educational changes, briefly explain the concept demonstrated and what the learner should inspect.
- 최종 응답에 변경한 파일과 수행한 검증을 명시한다.
  Mention files changed and verification performed in the final response.

## Codex·Claude 교대 작업 / Codex–Claude handoff

- 작업 시작 또는 인수 시 `git status --short`와 관련 파일의 diff를 확인한다. 기존 미커밋 변경을 작업 맥락으로 취급하고 임의로 지우지 않는다.
  At the start of a task or handoff, inspect `git status --short` and relevant diffs. Treat existing uncommitted changes as work context and do not erase them.
- 수정할 파일에 기존 변경이 있으면 먼저 읽고 이번 요청과 겹치는지 확인한다. 수정 중 다른 변경이 생겼다면 최신 내용을 다시 읽고 통합한다. 안전한 통합이 불분명하면 충돌 지점과 필요한 결정을 사용자에게 알린다.
  Read existing changes before editing a file and check for overlap with the current request. If a file changes during the task, reread and integrate the latest content. If safe integration is unclear, tell the user the exact conflict and decision needed.
- 동시 작업은 파일 또는 기능 단위로 범위를 나눈다. 겹치는 작업은 별도 Git worktree 또는 순차 작업으로 진행하고 통합 전에 diff를 비교한다.
  Divide concurrent work by file or feature. Use separate Git worktrees or work sequentially for overlapping tasks, and compare diffs before integration.
- `git reset`, `git checkout`, `git restore`, `git clean`, 일괄 덮어쓰기로 다른 작업의 변경을 지우지 않는다. 스테이징·커밋을 요청받으면 이번 작업의 파일만 선택한다.
  Do not erase another task's changes with `git reset`, `git checkout`, `git restore`, `git clean`, or bulk overwrites. When asked to stage or commit, select only files from the current task.
- 작업을 넘길 때 수정 파일, 검증 결과, 남은 문제, 다음 시작점을 간단히 기록한다. 다음 에이전트는 이 설명과 현재 Git·파일 상태를 함께 확인한다.
  At handoff, briefly report changed files, verification results, remaining issues, and the next starting point. The next agent checks that report against the current Git and file state.

## 유지보수 메모 / Maintenance notes

- 작업 내역·실행한 검사·미검증 범위는 [유지보수 기록](docs/maintenance.md)에 날짜와 함께 남긴다. 상세 기능 설명은 해당 `docs/` 문서에서 관리하고 README에 중복하지 않는다.
  Record dated changes, completed checks, and unverified scope in the [maintenance log](docs/maintenance.md). Keep detailed feature documentation in the corresponding `docs/` guide rather than duplicating it in the README.
- 2026-09-23 정리에서 홈 외 페이지·포트폴리오 편집기를 지연 로딩하고, HTTP 구현의 옵션·오류 처리와 저장 데이터 검증을 보강했다. 후속 수정에서도 공통 `PageOutlet`, 두 HTTP 구현의 계약 테스트, 저장 데이터 스키마를 함께 확인한다.
  The 2026-09-23 cleanup added lazy loading for secondary pages and the portfolio editor, aligned HTTP options and errors, and validated stored data. In follow-up changes, check the shared `PageOutlet`, both HTTP clients' contract tests, and storage schemas together.
- 크롤러 설정·이력은 MySQL을 사용한다. 제거된 `crawlerRun`·`CrawlerStandaloneApplication`을 복원하지 말고 일반 애플리케이션 진입점과 `bootRun`을 사용한다. 세션 로그인 전용 `crawlerSessionLogin`은 별도 도구로 유지한다.
  Crawler configuration and history require MySQL. Use the normal application entry point and `bootRun`; do not restore the removed `crawlerRun` or `CrawlerStandaloneApplication`. Keep `crawlerSessionLogin` as the separate session-login tool.
- 백엔드 검증에는 JDK 21과 Docker를 사용한다. 정적 검사와 Python 회귀 테스트의 명령은 [검증 가이드](docs/verification.md)를 따른다. 외부 크롤러 테스트의 기본 건너뜀을 외부 사이트 검증 성공으로 기록하지 않는다.
  Use JDK 21 and Docker for backend verification, and follow the [verification guide](docs/verification.md) for static checks and Python regression tests. Do not report the default skip of the external crawler test as successful external-site verification.
