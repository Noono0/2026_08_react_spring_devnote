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

