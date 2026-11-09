# 게시판 실전 가이드

[문서 목록으로](../README.md) · [학습 가이드](learning-guide.md)

## 사용 방법

`React 연습 → 게시판 실전`(`/react/boards`)을 엽니다. 화면 위 탭에서 **일반·공지·Q&A·갤러리·그리드·달력**을 전환합니다. 목록에서 제목과 본문을 검색하고 이전·다음 페이지로 이동할 수 있습니다.

로그인하면 `글쓰기`가 표시됩니다. 제목을 입력하고 Tiptap 에디터에서 본문을 작성한 뒤 저장합니다. 본문에서는 글자 서식, 목록, 표, 링크, 이미지 업로드를 사용할 수 있습니다. 이미지는 에디터에 붙여넣거나 끌어 놓을 수도 있습니다. 글 작성자와 관리자는 자신의 글을 수정·삭제할 수 있습니다. 다른 화면에서 먼저 수정된 글은 버전 충돌(409)로 저장을 거부하므로 최신 글을 확인한 뒤 다시 수정합니다.

| 유형 | 추가 규칙 |
|---|---|
| 일반 | 로그인 회원이 글을 작성합니다. |
| 공지 | 관리자(`ADMIN`, `SUPER_ADMIN`)만 작성·수정·삭제할 수 있으며 목록 상단 고정을 선택할 수 있습니다. |
| Q&A | 로그인 회원이 질문하고, 관리자가 에디터로 답변합니다. 답변은 질문당 하나이며 관리자만 삭제할 수 있습니다. |
| 갤러리 | 대표 이미지가 필수입니다. 이미지 파일을 서버에 올리면 목록에 카드로 표시됩니다. |
| 그리드 | AG Grid Community로 현재 페이지의 열 정렬·필터를 연습합니다. 제목을 누르면 상세·수정 화면으로 이동합니다. 서버 검색은 전체 게시글, 그리드 정렬·필터는 현재 불러온 최대 50건에 적용됩니다. |
| 달력 | 날짜가 필수입니다. 월 이동과 제목·내용 검색을 할 수 있고, 날짜의 `+`를 누르면 선택한 날짜로 글쓰기 화면이 열립니다. 한 달에 최대 500건을 표시하며 초과하면 안내를 보여 줍니다. |

이 화면은 실제 Spring Boot API와 MySQL을 사용합니다. 사이드바의 **더미 데이터 ON**은 기존 문서 학습 화면의 MSW 데이터에 적용되며, 통합 게시판의 임시 저장소는 제공하지 않습니다. 서버가 실행되지 않거나 게시판 테이블이 없으면 목록에서 오류가 표시됩니다.

## 학습할 코드 흐름

1. [`BoardLabPage.tsx`](../frontend/src/features/board-lab/BoardLabPage.tsx): URL로 게시판 종류·글 번호·모드를 정하고, 로컬 입력 상태와 TanStack Query의 서버 상태를 나눕니다.
2. [`boardApi.ts`](../frontend/src/features/board-lab/boardApi.ts): 여섯 게시판의 공통 HTTP 계약입니다. [`GridBoardList.tsx`](../frontend/src/features/board-lab/GridBoardList.tsx)는 클라이언트 정렬·필터, [`CalendarBoard.tsx`](../frontend/src/features/board-lab/CalendarBoard.tsx)는 월별 서버 조회를 보여 줍니다. 두 화면은 필요할 때만 불러옵니다.
3. [`RichTextEditor.tsx`](../frontend/src/features/rich-text-editor/components/RichTextEditor.tsx): 본문을 편집용 `contentJson`, 표시용 `contentHtml`, 검색용 `contentText`로 돌려줍니다.
4. [`BoardController.java`](../backend/src/main/java/com/example/devnote/board/controller/BoardController.java) → [`BoardService.java`](../backend/src/main/java/com/example/devnote/board/service/BoardService.java) → [`BoardDao.java`](../backend/src/main/java/com/example/devnote/board/dao/BoardDao.java) → [`BoardMapper.xml`](../backend/src/main/resources/mybatis/mapper/board/BoardMapper.xml): 요청·권한·SQL의 책임을 분리합니다.
5. [`schema.sql`](../backend/src/main/resources/schema.sql): `board_posts`, `board_answers`, `board_calendar_dates`를 생성합니다. 달력 날짜는 별도 테이블에 저장해 기존 글 테이블을 바꾸지 않습니다. 로컬은 기본적으로 `SQL_INIT_MODE=always`라 시작 시 없는 테이블을 만듭니다. 기존 운영 서버에서 `SQL_INIT_MODE=never`를 쓰면 [배포 가이드](deployment.md)의 새 테이블 적용 절차가 필요합니다.

에디터 HTML은 상세 화면에서 `sanitizeRichTextHtml`로 정리한 뒤 렌더링합니다. 대표 이미지와 본문에 올린 이미지는 작성자가 올린 파일인지 서버에서 확인하고, 저장 후 임시 상태를 활성 상태로 바꿉니다.
