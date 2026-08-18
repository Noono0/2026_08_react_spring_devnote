/**
 * ============================================================================
 * documentTypes.ts — 문서 기능의 타입 정의 (프론트와 백엔드의 "계약서")
 * ============================================================================
 *
 * ★★ 여기부터가 진짜 백엔드와 통신하는 영역이다.
 *   지금까지의 연습 페이지는 데이터가 브라우저 안에만 있었지만,
 *   문서 기능은 Spring Boot 서버 + MySQL과 실제로 주고받는다.
 *
 * [이 파일의 역할 — 계약서]
 *   여기 적힌 타입은 백엔드 Java DTO 클래스와 모양이 정확히 같아야 한다.
 *   한쪽만 바꾸면 통신이 깨진다.
 *     프론트: documentTitle    ↔  백엔드: DocumentResponse.documentTitle
 *   그래서 API 응답 구조를 바꿀 때는 항상 양쪽을 함께 확인해야 한다.
 *
 * [타입을 네 가지로 나눈 이유 — 매우 중요한 실무 개념]
 *   같은 "문서"인데 상황마다 필요한 정보가 다르다.
 *
 *   DocumentSearchCondition → 목록을 "조회할 때 보내는" 조건
 *   DocumentListItem        → 목록에 "표시할" 요약 정보 (본문 없음!)
 *   DocumentDetail          → 상세 화면에 필요한 "전체" 정보 (본문 포함)
 *   DocumentSaveRequest     → 저장할 때 "보내는" 데이터
 *
 *   ★ 목록에 본문이 없는 게 핵심이다.
 *     문서 20개의 본문을 전부 내려받으면 응답이 수 메가바이트가 된다.
 *     목록에서는 제목만 보이는데 말이다.
 *     "필요한 만큼만 주고받는다"가 API 설계의 기본이다.
 */

import type { JSONContent } from "@tiptap/core";
import type { DocumentAttachment } from "@/features/file/types/fileTypes";

// 문서의 공개 상태.
//   DRAFT(임시저장) → PUBLISHED(공개) → ARCHIVED(보관)
export type DocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * 목록 조회 조건. 이 객체가 그대로 `?key=value` 쿼리스트링이 되어 서버로 간다.
 *
 * ★ 검색 조건을 이렇게 하나의 객체로 묶어 두면 좋은 점
 *   - 함수 인자가 8개로 늘어나지 않는다
 *   - TanStack Query의 queryKey에 통째로 넣을 수 있다
 *     → 조건이 하나라도 바뀌면 키가 달라져 자동으로 다시 조회된다
 *   - URL 쿼리스트링과 1:1로 대응시키기 쉽다
 */
export interface DocumentSearchCondition {
  searchKeyword: string;
  // 어디를 검색할지. 제목만/본문만/둘 다/작성자
  searchType: "TITLE" | "CONTENT" | "TITLE_CONTENT" | "AUTHOR";
  // `?`가 붙은 것은 선택 조건이다. 없으면 서버가 "전체"로 처리한다.
  documentStatus?: DocumentStatus;
  authorId?: number;
  pageNumber: number;
  pageSize: number;
  // 정렬 기준과 방향.
  // ★ 프론트에서 정렬하지 않고 서버에 맡기는 이유:
  //   프론트는 현재 페이지의 20건만 갖고 있어서, 그것만 정렬해 봐야
  //   "전체에서 가장 조회수 높은 글"을 찾을 수 없다.
  //   정렬과 페이징은 반드시 짝으로 서버에서 처리해야 한다.
  sortProperty: "CREATED_AT" | "UPDATED_AT" | "VIEW_COUNT" | "TITLE";
  sortDirection: "ASC" | "DESC";
}

/**
 * 목록에 한 줄로 표시되는 요약 정보.
 * ★ contentJson, contentHtml 같은 본문이 없다는 점을 꼭 확인하자.
 */
export interface DocumentListItem {
  documentId: number;
  documentTitle: string;
  documentStatus: DocumentStatus;
  thumbnailFileId?: number;
  thumbnailImageUrl?: string;

  // ★ 낙관적 잠금(optimistic locking)용 버전 번호.
  //   문서를 수정할 때마다 1씩 올라간다.
  //   저장할 때 이 번호를 함께 보내면 서버가 확인한다:
  //     "네가 알고 있는 버전이 3인데 지금은 5다 → 그 사이 누가 수정했다"
  //   → 409 Conflict로 거부해서 남의 수정 내용을 덮어쓰는 걸 막는다.
  //   자세한 처리는 DocumentEditorPage.tsx를 보자.
  versionNumber: number;

  viewCount: number;
  authorId: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 페이지네이션 정보.
 *
 * ★ 이 구조는 백엔드가 직접 만든 PageResponse record와 1:1로 짝을 이룬다.
 *   backend/src/main/java/com/example/devnote/document/dto/PageResponse.java
 *   여섯 개 항목의 이름과 순서가 그대로 같다. 한쪽만 바꾸면 통신이 깨진다.
 *
 *   ※ 이 프로젝트는 JPA가 아니라 MyBatis를 쓰므로 Spring Data의 Page가 아니다.
 *     totalPages와 firstPage/lastPage를 PageResponse.of()에서 직접 계산한다.
 */
export interface PageInformation {
  pageNumber: number;     // 현재 페이지 번호
  pageSize: number;       // 한 페이지에 몇 개
  totalElements: number;  // 조건에 맞는 전체 건수
  totalPages: number;     // 전체 페이지 수
  // ★ 첫/마지막 페이지 여부를 서버가 미리 계산해 준다.
  //   프론트에서 `pageNumber === 1` 로 판단할 수도 있지만,
  //   서버가 알려주면 "이전/다음 버튼을 잠글지"를 고민 없이 결정할 수 있다.
  firstPage: boolean;
  lastPage: boolean;
}

/**
 * 목록 API의 응답.
 *
 * ★ 왜 배열만 주지 않고 이렇게 감쌌을까?
 *   배열만 오면 "지금 몇 페이지인지, 전체가 몇 건인지"를 알 수 없다.
 *   그러면 페이지 버튼을 몇 개 그려야 할지 계산할 수가 없다.
 *   목록 API는 거의 항상 이렇게 데이터 + 페이지 정보를 함께 준다.
 */
export interface DocumentListResponse {
  content: DocumentListItem[];
  pageInformation: PageInformation;
}

/**
 * 상세 화면에 필요한 문서 전체 정보.
 */
export interface DocumentDetail {
  documentId: number;
  authorId: number;
  authorName: string;
  documentTitle: string;

  // ★★ 본문을 세 가지 형태로 저장하는 이유. 처음 보면 이상하지만 다 쓸모가 있다.
  //
  //   contentJson : 에디터(Tiptap)가 쓰는 구조화된 형식.
  //                 다시 편집할 때 이걸 그대로 불러온다. "원본"에 해당한다.
  //   contentHtml : 화면에 보여줄 HTML. 상세 페이지에서 그대로 렌더링한다.
  //                 매번 JSON에서 변환하지 않아도 되어 빠르다.
  //   contentText : 태그를 뺀 순수 글자. 검색과 미리보기에 쓴다.
  //                 HTML에서 검색하면 <strong> 같은 태그가 걸려서 안 된다.
  //
  //   "같은 데이터를 세 벌 저장하면 낭비 아닌가?" 싶지만,
  //   읽기 성능을 위해 일부러 중복을 허용하는 것을 비정규화(denormalization)라고 한다.
  //   글은 한 번 쓰고 여러 번 읽히므로 이쪽이 이득이다.
  //
  //   ★ 다만 세 개가 서로 어긋나지 않게 저장 시점에 한꺼번에 만들어야 한다.
  //     RichTextEditor.tsx에서 그 처리를 볼 수 있다.
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
  thumbnailFileId?: number;
  thumbnailImageUrl?: string;
  attachmentFiles: DocumentAttachment[];
  documentStatus: DocumentStatus;
  versionNumber: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 에디터 화면의 폼이 다루는 값.
 *
 * ★ DocumentSaveRequest와 따로 둔 이유
 *   본문(contentJson 등)은 Tiptap 에디터가 별도로 관리한다.
 *   React Hook Form이 다루는 건 제목/상태/변경요약 세 가지뿐이다.
 *   "폼이 관리하는 것"과 "서버에 보낼 것"을 구분한 것이다.
 */
export interface DocumentFormValues {
  documentTitle: string;
  documentStatus: DocumentStatus;
  changeSummary?: string;
}

/**
 * 저장(등록/수정) 시 서버로 보내는 데이터.
 */
export interface DocumentSaveRequest {
  documentTitle: string;
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
  documentStatus: DocumentStatus;
  thumbnailFileId?: number;

  // ★ 파일 "객체"가 아니라 id 배열을 보낸다는 점이 중요하다.
  //   업로드는 이미 따로 끝나 있고(파일 API), 여기서는 연결만 한다.
  //   흐름: 파일 업로드 → 서버가 fileId 발급 → 문서 저장 시 그 id들을 첨부
  //   문서와 파일을 한 요청에 섞으면 요청이 무거워지고 실패 시 복구가 어렵다.
  attachmentFileIds: number[];

  // ★ 수정할 때만 보낸다. 그래서 `?`가 붙어 있다.
  //   서버가 이 번호로 "그 사이 누가 먼저 수정했는지"를 판정한다.
  //   새로 만들 때는 비교할 대상이 없으므로 보내지 않는다.
  versionNumber?: number;

  // 무엇을 왜 바꿨는지 적는 메모. 변경 이력을 남기는 용도다.
  changeSummary?: string;
}
