/**
 * ============================================================================
 * historyTypes.ts — 포트폴리오 "업무 History" 기능의 타입 정의
 * ============================================================================
 *
 * [이 파일이 따로 있는 이유]
 *   업무 History는 백엔드에서 학습용 문서와 같은 documents 테이블을 쓰고,
 *   범위(document_scope)만 HISTORY로 나눠 저장한다. (HistoryController → /api/v1/history)
 *   그래서 응답 모양은 14단계 학습용 문서(practice/14-documents/types/documentTypes.ts)와 같다.
 *
 *   그런데도 타입을 복사해 따로 두었다.
 *     - 학습자는 14단계 폴더를 마음껏 고치며 실습한다
 *     - 그 타입을 History가 import하고 있으면, 실습 중 바꾼 한 줄이 실제 포트폴리오를 깨뜨린다
 *   "실습장"과 "운영 화면"이 서로를 모르게 하려는 의도적인 중복이다.
 *
 * ★ 백엔드 계약과 맞춰야 하는 곳
 *   backend/src/main/java/com/example/devnote/document/dto 의
 *   DocumentListItemResponse, DocumentDetailResponse, DocumentCreateRequest,
 *   DocumentUpdateRequest, DocumentSearchCondition, DocumentTagCountResponse, PageResponse.
 *   필드 이름이 document… 로 시작하는 것도 그 DTO 이름을 그대로 따랐기 때문이다.
 */

import type { JSONContent } from "@tiptap/core";
import type { DocumentAttachment } from "@/features/file/types/fileTypes";

// 글의 공개 상태. 방문자에게는 PUBLISHED(발행)만 보인다. (서버 HistoryController가 강제한다)
export type HistoryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * 목록 조회 조건. 이 객체가 그대로 `?key=value` 쿼리스트링이 되어 서버로 간다.
 * TanStack Query의 queryKey에도 통째로 들어가므로, 조건이 바뀌면 자동으로 다시 조회된다.
 */
export interface HistorySearchCondition {
  searchKeyword: string;
  // 어디를 검색할지. 제목만/본문만/둘 다/작성자
  searchType: "TITLE" | "CONTENT" | "TITLE_CONTENT" | "AUTHOR";
  // 없으면 서버가 "전체 상태"로 처리한다. 단, 방문자는 서버가 PUBLISHED로 고정한다.
  documentStatus?: HistoryStatus;
  /** 이 태그가 붙은 글만 조회한다(목록 위 태그 필터). */
  tag?: string;
  pageNumber: number;
  pageSize: number;
  // 정렬은 페이징과 짝으로 서버가 처리한다. (화면에 있는 한 페이지만 정렬하면 전체 순서가 틀린다)
  sortProperty: "CREATED_AT" | "UPDATED_AT" | "VIEW_COUNT" | "TITLE";
  sortDirection: "ASC" | "DESC";
}

/** 목록에 한 줄로 표시되는 요약 정보. 본문(contentHtml 등)은 목록 응답에 없다. */
export interface HistoryListItem {
  documentId: number;
  documentTitle: string;
  documentStatus: HistoryStatus;
  thumbnailFileId?: number;
  thumbnailImageUrl?: string;
  // 낙관적 잠금용 버전 번호. 수정할 때마다 1씩 오른다.
  versionNumber: number;
  viewCount: number;
  authorId: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

/** 페이지 정보. 백엔드 PageResponse record와 이름·순서가 같다. */
export interface HistoryPageInformation {
  pageNumber: number;     // 현재 페이지 번호 (0부터)
  pageSize: number;       // 한 페이지에 몇 개
  totalElements: number;  // 조건에 맞는 전체 건수
  totalPages: number;     // 전체 페이지 수
  firstPage: boolean;
  lastPage: boolean;
}

/** 목록 API 응답 = 글 목록 + 페이지 정보 */
export interface HistoryListResponse {
  content: HistoryListItem[];
  pageInformation: HistoryPageInformation;
}

/** 상세 화면에 필요한 글 전체 정보. */
export interface HistoryDetail {
  documentId: number;
  authorId: number;
  authorName: string;
  documentTitle: string;
  // 본문 세 벌: 다시 편집할 JSON / 화면에 보여 줄 HTML / 검색용 순수 텍스트
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
  thumbnailFileId?: number;
  thumbnailImageUrl?: string;
  attachmentFiles: DocumentAttachment[];
  tags: string[];
  documentStatus: HistoryStatus;
  versionNumber: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 작성 화면의 폼(React Hook Form)이 다루는 값. 본문은 에디터가 따로 관리한다. */
export interface HistoryFormValues {
  documentTitle: string;
  documentStatus: HistoryStatus;
  changeSummary?: string;
  /** 쉼표로 구분한 태그 입력값. 저장 요청에서는 tags 배열로 바뀐다. */
  tagText?: string;
}

/** 저장(등록/수정) 시 서버로 보내는 데이터. */
export interface HistorySaveRequest {
  documentTitle: string;
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
  documentStatus: HistoryStatus;
  thumbnailFileId?: number;
  // 파일은 이미 업로드가 끝나 있고, 여기서는 "이 글에 붙일 파일 번호"만 보낸다.
  attachmentFileIds: number[];
  /** 앞뒤 공백·맨 앞 #은 서버가 정리한다. 최대 10개, 각 20자 */
  tags: string[];
  // 수정할 때만 보낸다. 서버가 이 번호로 "그 사이 누가 먼저 수정했는지"를 판정한다.
  versionNumber?: number;
  // 무엇을 왜 바꿨는지 남기는 메모(변경 이력용).
  changeSummary?: string;
}

/** 태그 필터 버튼에 보여 줄 태그와 그 태그가 붙은 글 수 (GET /history/tags) */
export interface HistoryTagCount {
  tagName: string;
  documentCount: number;
}
