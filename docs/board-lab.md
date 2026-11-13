# 게시판 실전 가이드

[문서 목록으로](../README.md) · [학습 가이드](learning-guide.md)

## 사용 방법

`React 연습 → 게시판 실전`(`/react/boards`)을 엽니다. 화면 위 탭은 **통합 게시판·갤러리·그리드·달력·팝업**으로 구성됩니다. 통합 게시판에서 일반·공지·Q&A 글을 함께 보고, 분류 셀렉트박스와 제목·본문 검색으로 원하는 글을 찾습니다.

일반·공지·Q&A를 별도 탭 대신 **통합 게시판의 분류**로 제공합니다. 기존 글 번호·본문·답변과 상세 URL은 유지하며 데이터를 옮기지 않습니다. 공지 상단 고정은 통합 목록에서도 우선 적용됩니다. 서버가 세 분류를 함께 검색·정렬·페이지 처리하므로 일부 페이지를 브라우저에서 합치는 방식이 아닙니다. 갤러리·그리드·달력·팝업은 별도 용도로 관리합니다.

로그인하면 `글쓰기`가 표시됩니다. 제목을 입력하고 Tiptap 에디터에서 본문을 작성한 뒤 저장합니다. 본문에서는 글자 서식, 목록, 표, 링크, 이미지 업로드를 사용할 수 있습니다. 이미지는 에디터에 붙여넣거나 끌어 놓을 수도 있습니다. 글 작성자와 관리자는 자신의 글을 수정·삭제할 수 있습니다. 다른 화면에서 먼저 수정된 글은 버전 충돌(409)로 저장을 거부하므로 최신 글을 확인한 뒤 다시 수정합니다.

| 유형 | 추가 규칙 |
|---|---|
| 일반 | 로그인 회원이 글을 작성합니다. |
| 공지 | 관리자(`ADMIN`, `SUPER_ADMIN`)만 작성·수정·삭제할 수 있으며 목록 상단 고정을 선택할 수 있습니다. |
| Q&A | 로그인 회원이 질문하고, 관리자가 에디터로 답변합니다. 답변은 질문당 하나이며 관리자만 삭제할 수 있습니다. |
| 갤러리 | 대표 이미지가 필수입니다. 이미지 파일을 서버에 올리면 목록에 카드로 표시됩니다. |
| 그리드 | AG Grid Community로 현재 페이지의 열 정렬·필터를 연습합니다. 제목을 누르면 상세·수정 화면으로 이동합니다. 서버 검색은 전체 게시글, 그리드 정렬·필터는 현재 불러온 최대 50건에 적용됩니다. |
| 달력 | 시작일(From)~종료일(To)이 필수입니다. 기본값은 둘 다 당일이며 양 끝 날짜를 포함합니다. 월 이동과 제목·내용 검색을 할 수 있고, 날짜의 `+`를 누르면 선택한 날짜를 시작일·종료일에 채웁니다. 한 달에 최대 500개 글을 조회하며 초과하면 안내를 보여 줍니다. |
| 팝업 | 관리자만 관리합니다. 메뉴 URL·하위 경로 포함 여부·노출 사용 여부·시작일~종료일을 설정하고, 해당 메뉴에서 제목·본문을 모달로 표시합니다. |

## 일반·공지·Q&A는 무엇이 다른가요?

목록 모양과 제목·본문 에디터는 같지만, 권한과 처리 흐름이 다릅니다.

| 확인할 동작 | 일반 | 공지 | Q&A |
|---|---|---|---|
| 새 글 | 로그인 회원 | 관리자만 | 로그인 회원이 질문 |
| 수정·삭제 | 작성자 또는 관리자 | 관리자만 | 질문 작성자 또는 관리자 |
| 상단 고정 | 없음 | 선택 가능, **통합 목록에서도** 우선 표시 | 없음 |
| 별도 답변 | 없음 | 없음 | 관리자만 질문당 답변 1개 등록·삭제 |
| 처리 상태 | 없음 | 없음 | 답변 대기 → 답변 완료, 답변 삭제 시 다시 대기 |

통합 게시판의 `글쓰기`에서 분류를 선택합니다. 일반 회원은 일반·Q&A를 선택할 수 있고, 관리자는 공지도 선택할 수 있습니다. 분류를 바꾸어도 제목과 본문은 유지되며, 공지를 선택하면 상단 고정 옵션, Q&A를 선택하면 질문 작성 안내가 표시됩니다. 공지에서 다른 분류로 바꾸면 고정 옵션은 해제됩니다. 기존 글을 수정할 때는 답변과 권한 규칙을 보존하기 위해 분류를 바꿀 수 없습니다.

화면에서 선택지만 제한하는 것이 아니라 Service에서도 공지 관리·Q&A 답변 권한을 검사합니다. Q&A는 공개 질문·관리자 답변 실습이며, 비밀글이나 답변 채택 기능은 제공하지 않습니다. 기존 일반·공지·Q&A 목록 주소로 들어가면 해당 분류를 선택한 통합 목록을 보여 줍니다.

저장 중에는 분류 변경과 중복 제출을 막으며, 응답 뒤에는 저장 요청 당시의 분류 상세 화면으로 이동합니다. 편집 권한이 포함된 상세 조회와 팝업 관리 목록은 계정·관리자 여부별로 캐시를 구분합니다. 계정이 바뀌면 예약·중지 팝업의 관리 캐시와 진행 중 요청을 제거합니다.

## 메뉴·기간별 팝업

1. 관리자로 로그인하고 `팝업 게시판 → 글쓰기`를 엽니다.
2. 제목과 Tiptap 본문을 입력하고 **표시할 메뉴 URL**을 `/react/boards`처럼 입력합니다. 도메인·쿼리 문자열·해시 없이 `/`로 시작하는 내부 메뉴 경로를 사용합니다. 경로에는 영문·숫자·하이픈·밑줄을 사용할 수 있습니다.
3. `하위 경로에서도 표시`를 끄면 해당 메뉴에서만 표시합니다. 켜면 `/react/boards/general/1` 같은 하위 메뉴에서도 표시하지만 `/react/boards-other`에는 표시하지 않습니다. `/`에 하위 경로 포함을 켜면 전체 메뉴에 적용됩니다.
4. 시작일~종료일을 선택합니다. 기본값은 당일이며 **한국 시간(Asia/Seoul) 기준으로 양 끝 날짜를 포함**합니다. `팝업 노출 사용`을 끄면 기간 안에서도 표시하지 않습니다.
5. 저장한 상세 화면의 `팝업 미리보기`로 제목·본문을 확인합니다. 관리 목록에는 예약·노출 중·기간 종료·노출 중지 상태와 대상 메뉴·기간이 표시됩니다.

방문자는 해당 URL에서 현재 노출 중인 팝업만 받습니다. 관리 목록·상세·등록·수정·삭제는 관리자 전용이며 예약·중지된 본문을 공개 조회에 포함하지 않습니다. 여러 팝업은 하나씩 보여 주고 닫으면 다음 것을 표시합니다. 검색 조건만 바뀔 때는 닫은 팝업을 다시 열지 않고, 다른 메뉴에 진입하면 새 경로로 조회합니다. 팝업 관리 경로에서는 자동 팝업을 표시하지 않습니다.

서버가 기간·URL 매칭을 검사하며, 화면은 1분마다 활성 목록을 다시 확인합니다. 한국 시간 자정에는 만료된 팝업을 즉시 숨기고 새 날짜의 목록을 조회합니다. 본문 HTML은 공통 정리 함수를 거쳐 표시하며, 공통 `ModalDialog`의 닫기·Esc·포커스 처리를 사용합니다.

팝업은 방문자에게 공개하는 안내이며, 메뉴 경로는 표시 위치를 정하는 조건입니다. 백엔드 없이 실행하는 `VITE_DATA_SOURCE=mock` 온라인 모의 모드에서는 전역 팝업을 조회하지 않습니다.

## 달력의 기간 입력

- 날짜를 선택하지 않고 `글쓰기`를 열면 브라우저 현지 날짜를 시작일과 종료일에 채웁니다.
- 하루짜리 기간에서 시작일을 바꾸면 종료일도 같은 날로 이동합니다. 여러 날을 등록하려면 종료일을 별도로 선택합니다.
- 날짜는 1900-01-01~2100-12-31 범위이며, 종료일이 시작일보다 빠르면 입력칸으로 포커스를 옮기고 저장을 막습니다. 서버도 같은 규칙을 검사합니다.
- 예를 들어 `2026-11-30 ~ 2026-12-02` 글은 11월 30일과 12월 1·2일에 표시됩니다. 해당 월과 **기간이 겹치는** 글을 조회하므로 이전 달에 시작한 일정도 빠지지 않습니다. 월 조회의 500건 제한은 날짜별 반복 표시 횟수가 아닌 게시글 수입니다.
- 기존 단일 날짜 글은 같은 날 시작하고 끝나는 기간으로 읽습니다. API의 `eventDate`는 시작일, 새 `eventEndDate`는 종료일이며, 이전 클라이언트가 종료일을 보내지 않으면 서버가 시작일과 같은 날로 저장합니다.

## 공휴일·대체공휴일과 휴일 관리

달력 날짜 칸에 한국 공휴일과 대체공휴일의 이름을 표시합니다. 일요일과 공휴일은 붉은색, 토요일은 파란색이며 회사 휴무일은 별도 색·`휴무` 문구로 구분합니다. 게시글을 검색하거나 게시글 조회가 실패해도 휴일 표시는 별도로 유지합니다.

현재 **2026·2027년의 확인된 공식 자료**를 [`korean-holidays.json`](../backend/src/main/resources/calendar/korean-holidays.json)에 포함했습니다. 출처는 한국천문연구원의 [2026년](https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026)·[2027년](https://astro.kasi.re.kr/kor/life/post/calendarData?year=2027) 달력자료와 우주항공청의 [2027년 월력요항 발표](https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431)이며, 확인일은 2026-11-13입니다. 2026년 자료에는 우주항공청 발표에서 확인한 노동절·제헌절 추가도 반영했습니다.

**API 연동**: 서버의 `DATA_GO_KR_SERVICE_KEY`에 [한국천문연구원 특일 정보](https://www.data.go.kr/data/15012690/openapi.do) 활용신청이 승인된 인증키를 설정하면 `getRestDeInfo`의 연간 XML 자료를 조회합니다. Encoding·Decoding 키를 모두 지원하며 브라우저에는 인증키를 전달하지 않습니다. 날짜·이름·공휴일 여부·결과코드·전체 건수를 검증하고 대체공휴일·임시공휴일 이름에 따라 종류를 구분합니다. 외부 XML의 DTD·외부 엔티티를 차단하고 시간 제한을 적용하며, 인증키가 포함될 수 있는 주소·응답·원본 오류는 로그에 기록하지 않습니다.

조회한 연도 자료는 MySQL `calendar_holiday_cache`에 저장합니다. 같은 한국 날짜에 다시 조회하면 DB 저장본을 사용하며, 날짜가 바뀐 뒤 해당 연도를 조회할 때 API로 갱신합니다. 백그라운드 예약 작업은 아닙니다. 갱신 실패 시 1시간 동안 재시도를 줄이고 **마지막 DB 저장본 → 2026·2027년 포함 자료** 순서로 사용합니다. 화면에 자료 출처·확인일·갱신 실패 안내를 표시합니다. API 키가 없어도 저장본·포함 자료를 볼 수 있습니다. 빈 연간 응답이나 잘못된 자료로 저장본을 덮어쓰지 않습니다.

같은 연도의 동시 조회만 묶으므로 한 연도의 느린 외부 응답이 다른 연도의 저장본 조회를 막지 않습니다. 저장본의 확인일이 미래이면 잘못된 자료로 보고 재조회합니다. 외부 응답은 수신 중 256KiB 상한을 적용하며 초과하면 즉시 취소하고 기존 자료를 사용합니다.

서버 실행 방법별 설정은 다음과 같습니다.

- 로컬 `bootRun`: Git에서 제외된 저장소 루트 `.local/holiday-api.env`에 `DATA_GO_KR_SERVICE_KEY=발급받은값`을 저장합니다. `local` 프로필이 이 파일을 읽습니다. 환경 변수로 지정해도 됩니다.
- 로컬 Docker Compose: Git에서 제외된 루트 `.env`에 같은 변수를 설정하고 백엔드를 재생성합니다.
- 운영: 서버의 `.env.app`에 같은 변수를 설정합니다. 변경된 이미지와 `compose.app.yml`을 적용해 백엔드를 재생성해야 합니다. 로컬 파일을 수정하는 것만으로 운영에 적용되지는 않습니다.

실제 조회 가능한 연도는 제공기관의 발표 범위에 따릅니다. API·DB·포함 자료에 없는 연도에는 `공식 공휴일 자료가 아직 등록되지 않았습니다`라고 알리고 직접 등록한 휴일만 보여 줍니다. 화면의 지원 연도는 현재 DB 또는 포함 자료에 확보된 연도입니다. 확인되지 않은 음력 날짜·대체일을 계산해 실제 공휴일처럼 표시하지 않습니다. 국가가 새로 지정한 대체·임시공휴일도 제공기관이 반영한 뒤 다음 갱신 때 표시됩니다.

관리자는 달력의 `휴일 관리`를 펼쳐 다음과 같이 보완할 수 있습니다.

1. 휴일 날짜와 이름을 입력하고 공휴일·대체공휴일·임시공휴일·회사 휴무일 중 종류를 선택합니다.
2. `휴일 추가`로 저장하면 같은 달을 보는 모든 사용자에게 표시됩니다. 날짜는 1900~2100년이며, 같은 날짜·이름의 중복은 거부합니다.
3. `이 달에 직접 등록한 휴일`에서 수정하거나 확인 후 삭제합니다. 동시 수정·삭제는 버전을 검사해 오래된 요청이 덮어쓰지 못하게 합니다.

공식 원본은 수정·삭제하지 않으며, 관리자 추가 휴일은 MySQL `calendar_holidays`에 따로 저장합니다. 일반 회원에게 관리 기능은 표시하지 않고 서버도 관리 요청을 거부합니다. 회사 휴무일을 등록하는 것은 이 사이트의 달력 표시 설정이며 국가 공휴일을 지정하는 기능은 아닙니다.

[`CalendarHolidayController.java`](../backend/src/main/java/com/example/devnote/board/controller/CalendarHolidayController.java) → [`CalendarHolidayService.java`](../backend/src/main/java/com/example/devnote/board/service/CalendarHolidayService.java) → DAO·Mapper가 공식 자료와 저장된 추가 휴일을 합칩니다. [`calendarHolidayApi.ts`](../frontend/src/features/board-lab/calendarHolidayApi.ts)는 응답 날짜·종류·식별자·버전을 검증하며, [`CalendarHolidayManager.tsx`](../frontend/src/features/board-lab/CalendarHolidayManager.tsx)는 관리자 입력과 확인 삭제를 담당합니다.

이 화면은 실제 Spring Boot API와 MySQL을 사용합니다. 사이드바의 **더미 데이터 ON**은 기존 문서 학습 화면의 MSW 데이터에 적용되며, 통합 게시판의 임시 저장소는 제공하지 않습니다. 서버가 실행되지 않거나 게시판 테이블이 없으면 목록에서 오류가 표시됩니다.

API 조회·XML 검증은 [`KoreanHolidayApiClient.java`](../backend/src/main/java/com/example/devnote/board/service/KoreanHolidayApiClient.java), 일일 갱신과 저장본·포함 자료 선택은 [`KoreanHolidaySourceService.java`](../backend/src/main/java/com/example/devnote/board/service/KoreanHolidaySourceService.java)가 담당합니다. `CalendarHolidayCacheDao`와 Mapper는 공식 자료를 저장하며, 관리자 추가 휴일 DAO와 분리되어 있습니다.

## 학습할 코드 흐름

1. [`BoardLabPage.tsx`](../frontend/src/features/board-lab/BoardLabPage.tsx): URL로 게시판 종류·글 번호·모드를 정하고, 로컬 입력 상태와 TanStack Query의 서버 상태를 나눕니다.
2. [`boardApi.ts`](../frontend/src/features/board-lab/boardApi.ts): 공통 HTTP 계약과 통합 목록·공개 팝업 조회입니다. [`CommunityBoardList.tsx`](../frontend/src/features/board-lab/CommunityBoardList.tsx)는 서버 분류 필터·페이지 처리, [`PopupDisplay.tsx`](../frontend/src/features/board-lab/PopupDisplay.tsx)는 메뉴 이동·기간에 따른 전역 모달 표시를 담당합니다. 그리드·달력 화면은 필요할 때만 불러옵니다.
3. [`RichTextEditor.tsx`](../frontend/src/features/rich-text-editor/components/RichTextEditor.tsx): 본문을 편집용 `contentJson`, 표시용 `contentHtml`, 검색용 `contentText`로 돌려줍니다.
4. [`BoardController.java`](../backend/src/main/java/com/example/devnote/board/controller/BoardController.java) → [`BoardService.java`](../backend/src/main/java/com/example/devnote/board/service/BoardService.java) → [`BoardDao.java`](../backend/src/main/java/com/example/devnote/board/dao/BoardDao.java) → [`BoardMapper.xml`](../backend/src/main/resources/mybatis/mapper/board/BoardMapper.xml): 요청·권한·SQL의 책임을 분리합니다.
5. [`schema.sql`](../backend/src/main/resources/schema.sql): 게시글·답변·달력 기간·팝업 설정·관리자 추가 휴일을 생성합니다. 팝업은 게시글의 에디터 본문과 파일 소유권 검증을 재사용하고, 메뉴·기간 설정만 별도 테이블에 보관합니다.

에디터 HTML은 상세 화면에서 `sanitizeRichTextHtml`로 정리한 뒤 렌더링합니다. 대표 이미지와 본문에 올린 이미지는 작성자가 올린 파일인지 서버에서 확인하고, 저장 후 임시 상태를 활성 상태로 바꿉니다.

API 연동 버전에서는 [`2026-11-13-calendar-holiday-cache.sql`](../scripts/migrations/2026-11-13-calendar-holiday-cache.sql)도 대상 DB에 먼저 적용합니다. 새 DB는 `schema.sql`에 포함되어 있습니다. 공식 API 저장본과 관리자 추가 휴일은 서로 다른 테이블을 사용하므로 자동 갱신이 관리자 휴일을 덮어쓰지 않습니다.

## 기존 DB에 기간 컬럼 적용

새 DB는 `schema.sql`로 기간 컬럼까지 생성됩니다. **기존 로컬·운영 DB에서는 새 백엔드를 시작하기 전에** [`2026-11-13-board-calendar-period.sql`](../scripts/migrations/2026-11-13-board-calendar-period.sql)을 해당 DB에 한 번 실행합니다. `SQL_INIT_MODE=always`나 JPA의 `update`만으로는 기존 MyBatis 전용 테이블에 컬럼이 추가되지 않습니다.

로컬 Docker Compose의 MySQL을 사용한다면 저장소 루트에서 실행합니다. 운영 DB에는 해당 서버의 DB 접속 방식으로 같은 SQL 파일을 실행하며, 이 로컬 명령이 운영 DB를 변경하지는 않습니다.

```powershell
# Windows PowerShell
Get-Content -Raw scripts/migrations/2026-11-13-board-calendar-period.sql | docker compose exec -T mysql sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

```sh
# macOS / Linux / Git Bash
docker compose exec -T mysql sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < scripts/migrations/2026-11-13-board-calendar-period.sql
```

스크립트는 컬럼 존재 여부를 확인하므로 재실행할 수 있습니다. 기존 날짜와 글은 수정하지 않으며, 종료일이 비어 있는 기존 글은 Mapper의 `COALESCE`로 시작일과 같은 종료일을 반환합니다. MySQL 통합 테스트는 이전 테이블에 마이그레이션을 두 번 적용한 뒤 기존 글의 보존과 기간 조회·수정·삭제를 확인합니다.

팝업 기능을 추가한 버전에서는 [`2026-11-13-board-popups.sql`](../scripts/migrations/2026-11-13-board-popups.sql), 공휴일·휴일 관리 버전에서는 [`2026-11-13-calendar-holidays.sql`](../scripts/migrations/2026-11-13-calendar-holidays.sql)도 새 백엔드 시작 전에 대상 DB에 적용합니다. 위 명령의 파일 이름을 해당 파일로 바꾸면 됩니다. 모두 재실행할 수 있으며 기존 글·날짜·휴일은 변경하지 않습니다. 새 DB는 `schema.sql`에 모든 변경이 포함되어 있습니다. 통합 목록은 기존 일반·공지·Q&A 데이터를 그대로 조회하므로 별도 데이터 변환이 필요하지 않습니다.
