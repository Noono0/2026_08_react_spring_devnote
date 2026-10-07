// snippetTypes.ts — 개인 코드 조각 타입(서버 snippet/dto와 같은 모양). deleted = 휴지통에 있음.

export interface Snippet {
  snippetId: number;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  favorite: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SnippetSaveRequest {
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  favorite: boolean;
}

/** 목록 조건: status ACTIVE(보관함)/TRASH(휴지통), sort LATEST/TITLE/FAVORITE. 쿼리 문자열로 보내진다. */
export interface SnippetSearchCondition {
  pageNumber: number;
  pageSize: number;
  keyword: string;
  language: string;
  favoriteOnly: boolean;
  status: "ACTIVE" | "TRASH";
  sort: "LATEST" | "TITLE" | "FAVORITE";
}

export interface SnippetPageResponse {
  content: Snippet[];
  pageInformation: {
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    firstPage: boolean;
    lastPage: boolean;
  };
}

