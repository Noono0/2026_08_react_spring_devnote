# 실행·설정·문제 해결

[문서 목록으로](../README.md) · [검증 안내](verification.md)

별도 `cd`가 없으면 명령은 저장소 루트에서 실행합니다. Windows 로컬 백엔드는 **JDK 21**을 사용해야 합니다. `java -version`과 `JAVA_HOME`이 다른 JDK를 가리키면 Gradle 실행 전에 맞추세요.

## 가장 쉬운 실행 방법: Docker Compose

### 필요한 프로그램

Docker 방식만 사용할 경우 아래 프로그램만 설치하면 됩니다.

#### Windows

1. Docker Desktop 설치
2. 설치 후 Docker Desktop 실행
3. PowerShell 또는 명령 프롬프트 실행
4. 프로젝트 폴더로 이동

Docker Desktop에서 WSL 2 사용을 권장합니다.

#### macOS

Docker Desktop을 설치하고 실행합니다.

#### Linux

Docker Engine과 Docker Compose Plugin을 설치합니다.

설치 확인:

```bash
docker --version
docker compose version
```

### 환경설정 파일 생성

프로젝트 루트에서 실행합니다.

#### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

#### Windows 명령 프롬프트

```cmd
copy .env.example .env
```

#### macOS / Linux / Git Bash

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

### 전체 실행

#### Windows

```cmd
start-docker.cmd
```

또는 직접 실행:

```cmd
docker compose up --build -d
```

#### macOS / Linux / Git Bash

```bash
./start-docker.sh
```

또는 직접 실행:

```bash
docker compose up --build -d
```

처음 실행할 때 Gradle과 npm 의존성 및 Docker 이미지를 내려받기 때문에 인터넷 연결이 필요합니다.




### 실행 상태 확인

```bash
docker compose ps
```

정상 상태 예시:

```text
devnote-mysql      healthy
devnote-backend    healthy
devnote-frontend   running
```

### 접속 주소

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

### 로그 보기

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

### 종료

```bash
docker compose down
```

### DB와 업로드 파일까지 완전히 초기화

> 이 명령은 모든 개발 데이터를 삭제합니다.

```bash
docker compose down -v
```

다시 실행하면 Spring Boot가 schema.sql과 data.sql을 사용해 필요한 테이블과 Seed 데이터를 확인합니다.

---

## 로컬 개발 실행 방법

React와 Spring Boot 소스를 수정하면서 Hot Reload를 사용하려면 다음 방식이 편합니다.

```text
MySQL        Docker
Spring Boot 로컬 Java 프로세스
React        로컬 Vite 개발 서버
```

### Windows 빠른 실행 스크립트

저장소 루트의 `start-local-backend.cmd`는 Docker Desktop을 확인하고, MySQL만 컨테이너로 실행한 뒤 백엔드와 Vite를 각각 새 터미널에서 실행합니다. 먼저 `JAVA_HOME`이 JDK 21을 가리키는지 확인하세요.

- 포트 충돌을 피하려고 전체 앱의 `docker compose down`을 먼저 실행합니다. 실행 중인 전체 앱이 종료됩니다.
- `compose.dev.yml`의 개발용 DB 볼륨을 사용합니다. 전체 앱의 DB 데이터가 자동으로 복사되는 것은 아닙니다.
- MySQL 포트는 13306·23306·33306·43306·53306 순서로 시도하고 성공한 포트를 백엔드에 전달합니다.
- 로그는 `.local/logs/backend.log`, `.local/logs/frontend.log`에 남으며, 브라우저는 <http://localhost:5173>에서 엽니다.
- 백엔드와 Vite는 각 터미널에서 Ctrl+C로 종료하고, 개발 DB는 `docker compose -f compose.dev.yml down`으로 종료합니다.

### 로컬 개발에 필요한 프로그램

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

### MySQL만 Docker로 실행

프로젝트 루트에서:

```bash
docker compose -f compose.dev.yml up -d
```

확인:

```bash
docker compose -f compose.dev.yml ps
```

### Spring Boot 실행

아래 Gradle 명령은 `backend/` 디렉터리에서 실행합니다.

#### Gradle에서 자주 쓰는 명령

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

Windows PowerShell에서는 `./gradlew` 대신 `.\gradlew.bat`를 사용합니다. 명령 프롬프트에서는 `gradlew.bat`로 실행할 수 있습니다.


#### Windows PowerShell

```powershell
cd backend
.\gradlew.bat bootRun
```

#### macOS / Linux / Git Bash

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
FILE_TEMPORARY_RETENTION
FILE_TEMPORARY_CLEANUP_CRON
FILE_TEMPORARY_CLEANUP_ZONE
SERVER_PORT
INITIAL_SUPER_ADMIN_PASSWORD_HASH
AUTH_SESSION_TIMEOUT
SESSION_COOKIE_SECURE
```

### React 의존성 설치

의존성은 커밋된 `pnpm-lock.yaml` 기준으로 설치합니다. pnpm 버전은 `package.json`의 `packageManager`에 고정되어 있어 Node.js에 포함된 Corepack이 맞춰 줍니다. 새 터미널에서:

```bash
cd frontend
corepack pnpm install --frozen-lockfile
```

`corepack enable`을 한 번 실행해 두면 이후에는 `pnpm install`처럼 짧게 쓸 수 있습니다. 설치 뒤 `npm run dev`, `npm run test` 같은 스크립트 실행 명령은 그대로 사용할 수 있습니다.

의존성 설치가 끝나면 브라우저 Mock API를 위한 Service Worker를 생성합니다.

```bash
corepack pnpm exec msw init public --save
```

이 명령으로 `frontend/public/mockServiceWorker.js`가 만들어집니다.

Dockerfile과 CI도 같은 `pnpm install --frozen-lockfile`을 사용하므로 로컬·CI·배포 이미지의 의존성 버전이 같습니다. 의존성을 추가하거나 바꿀 때는 `pnpm add <패키지>@<버전>`으로 `package.json`과 `pnpm-lock.yaml`을 함께 갱신하고 두 파일을 같이 커밋합니다. `npm install`은 이 lock 파일을 읽지 않으므로 사용하지 않습니다.

### React 실행

```bash
npm run dev
```

접속:

```text
http://localhost:5173
```

Vite가 `/api` 요청을 `http://localhost:8080`으로 전달합니다.

---

## Axios와 Fetch 전환

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

## 실제 Backend와 더미 데이터 전환

### 실제 Spring Boot 사용

```env
VITE_DATA_SOURCE=backend
```

### MSW 더미 API 사용

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

## 로그인 계정과 학습용 회원 전환

실제 포트폴리오·업무 History·관리자 기능은 HttpOnly 세션 로그인으로 권한을 확인합니다.

| 로그인 ID | 초기 비밀번호 | 등급 | 역할 |
|---|---|---|---|
| `admin` | `admin1234` | `DIAMOND` | `SUPER_ADMIN` |

`ADMIN`과 `SUPER_ADMIN`은 관리자 메뉴를 볼 수 있고, 포트폴리오와 업무 History의 변경 기능은 `SUPER_ADMIN`만 사용할 수 있습니다. 초기 비밀번호는 로컬 확인용이므로 외부 배포 전에 반드시 교체합니다.

로그인 모달에서 `아이디 기억`을 선택하면 비밀번호가 아닌 로그인 ID만 `localStorage`에 저장합니다. `자동 로그인`을 선택하면 서버가 HttpOnly·SameSite 세션 쿠키를 최대 30일간 유지하며, 로그아웃할 때 쿠키와 자동 로그인 선택을 해제합니다. 기간은 `AUTH_REMEMBER_ME_DURATION`으로 조정할 수 있습니다.

같은 IP에서 같은 아이디로 15분 안에 5번 로그인에 실패하면 15분 동안 맞는 비밀번호로도 로그인할 수 없고 `429 LOGIN_TEMPORARILY_LOCKED`와 남은 시간이 표시됩니다(`LoginAttemptLimiter`). 로컬 실습 중 잠겼다면 15분을 기다리거나 백엔드를 재시작합니다. 횟수와 시간은 `AUTH_LOGIN_MAX_FAILURES`(기본 5), `AUTH_LOGIN_FAILURE_WINDOW`(기본 15m), `AUTH_LOGIN_LOCK_DURATION`(기본 15m)으로 바꿀 수 있습니다.

`/react/documents`의 소유권 오류 실습은 로그인과 별개로 기존 `X-Member-Id` 헤더 전환 기능을 유지합니다. 로그인하지 않은 요청에만 적용되며, 헤더가 없으면 1번 회원으로 처리합니다. 이 방식을 쓰는 API는 학습 문서(`/api/v1/documents`), 다이어그램(`/api/v1/diagrams`), 파일 업로드(`/api/v1/files`)입니다. 포트폴리오·업무 History·관리자 권한은 부여하지 않습니다. 개발 편의 기능이므로 외부 공개 전에는 [배포 가이드의 공개 전 체크리스트](deployment.md#12-외부-공개-전-체크리스트)에 따라 정리합니다.

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

## Backend 오류 응답

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

## SQL 로그 확인

Backend 로컬 또는 Docker 로그에서 다음 두 종류를 확인합니다.

### MyBatis 실행 정보

```text
[MYBATIS] mapperId=com.example.devnote.document.DocumentMapper.selectDocumentList,
command=SELECT, resultCount=10, elapsedMs=12
```

### 실제 파라미터가 포함된 SQL

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

## DB 초기화

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

## 검증

필수 도구·전체 테스트·정적 검사·외부 크롤러 검증은 [검증 안내](verification.md)를 참고하세요.




## API 빠른 테스트

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
| GET | `/api/v1/history` | 공개 업무 History 목록(슈퍼관리자는 임시글 포함). `?tag=태그`로 태그 필터 |
| GET | `/api/v1/history/tags` | 태그별 글 수(방문자는 공개 글 기준, 많이 쓴 순 30개) |
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
| POST | `/api/v1/portfolio/sections` | 포트폴리오 섹션 생성. PROJECT는 `techStack`·`roleSummary`·`repositoryUrl`·`demoUrl`도 저장 |
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
| PUT | `/api/v1/admin/permissions/{role}/{permission}` | 슈퍼관리자 역할별 권한 변경(표시용 값만 저장하며 실제 접근 권한에는 반영하지 않음) |
| GET | `/api/v1/admin/analytics` | 일간·월간 방문자, 페이지뷰와 최근 이용 이력 조회 |
| POST | `/api/v1/visits` | 세션 기반 페이지 방문 기록 |

포트폴리오 변경·이미지 업로드 요청은 슈퍼관리자 로그인 세션과 `X-Portfolio-Editor: true` 헤더가 모두 필요합니다. 브라우저 화면에서는 Axios·Fetch 공통 클라이언트가 이를 처리합니다.

### 미사용 업로드 파일 자동 정리

업로드한 파일은 `TEMP` 상태로 저장되고, 문서·포트폴리오에 연결하면 `ACTIVE`가 됩니다. 편집 중 이미지를 올렸다가 지우거나 저장하지 않고 나가면 `TEMP` 파일이 디스크에 남습니다. `TemporaryFileCleanupService`가 매일 한국 시간 04:30에 이런 파일을 정리합니다.

- 지우는 대상: 업로드 후 24시간이 지났고, 문서·문서 이력의 썸네일과 본문 HTML, 문서 첨부, 포트폴리오 썸네일·이미지 어디에도 쓰이지 않는 `TEMP` 파일
- 문서 본문 이미지는 저장 후에도 `TEMP`로 남으므로 본문 HTML의 `/files/{id}/` 주소까지 확인합니다. `ACTIVE` 파일은 지우지 않습니다.
- DB 행은 `DELETED`와 삭제 시각으로 남기고 디스크 파일만 지웁니다. 한 번에 최대 500개씩 처리합니다.
- 편집 화면을 24시간 넘게 열어 둔 채 저장하면 그 사이 올린 이미지가 정리될 수 있습니다.
- `FILE_TEMPORARY_RETENTION`(예: `48h`)으로 보관 기간을, `FILE_TEMPORARY_CLEANUP_CRON`(예: `0 0 3 * * *`)으로 실행 시각을 바꿀 수 있습니다.

---

## 자주 발생하는 문제

### 포트가 이미 사용 중

`.env`에서 변경합니다.

```env
MYSQL_PORT=3307
```

Docker Backend는 컨테이너 내부에서 `mysql:3306`으로 연결하므로 변경할 필요가 없습니다. 로컬 Spring Boot가 3307로 접속하려면 `DATABASE_URL`도 함께 변경해야 합니다.

### 포트가 이미 사용 중

```env
BACKEND_PORT=8081
```

로컬 Vite Proxy를 사용할 경우 `vite.config.ts`의 target도 맞춰야 합니다.

### React에서 Backend 연결 실패

확인 순서:

```bash
docker compose ps
docker compose logs backend
curl http://localhost:8080/actuator/health
```

Vite 로컬 실행 시 Spring Boot가 8080에서 실행되는지 확인합니다.

### MSW가 시작되지 않음

```bash
cd frontend
corepack pnpm exec msw init public --save
```

그리고:

```env
VITE_DATA_SOURCE=mock
```

Vite 서버를 다시 시작합니다.

### DB 초기화 또는 JPA 스키마 검증 실패

이미 적용된 마이그레이션 SQL을 수정했는지 확인합니다. 학습 DB를 초기화해도 되는 경우:

```bash
docker compose down -v
docker compose up --build -d
```

### 문서 수정 시 409

다른 요청이 먼저 문서를 수정하여 `versionNumber`가 바뀐 상황입니다. 상세 페이지를 새로고침한 뒤 다시 수정합니다. 브라우저 창 두 개로 의도적으로 재현할 수 있습니다.

### 파일 업로드 후 컨테이너 재시작

파일은 `devnote-file-storage` Docker Volume에 저장되므로 일반 재시작에는 유지됩니다. `docker compose down -v`를 실행하면 삭제됩니다.

### React 로그가 두 번 보임

개발 환경의 `React.StrictMode`가 Effect 정리와 순수성 문제를 찾기 위해 일부 코드를 추가 실행할 수 있습니다. 운영 빌드에서는 같은 방식으로 실행되지 않습니다. 단순히 Strict Mode를 제거하기 전에 Effect cleanup과 중복 요청 원인을 확인하세요.

---


### Docker 프론트 빌드에서 Vite 타입 충돌이 발생하는 경우

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
