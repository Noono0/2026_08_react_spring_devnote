import type { JSONContent } from "@tiptap/core";
import type { DocumentAttachment } from "@/features/file/types/fileTypes";

export type DocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface DocumentSearchCondition {
  searchKeyword: string;
  searchType: "TITLE" | "CONTENT" | "TITLE_CONTENT" | "AUTHOR";
  documentStatus?: DocumentStatus;
  authorId?: number;
  pageNumber: number;
  pageSize: number;
  sortProperty: "CREATED_AT" | "UPDATED_AT" | "VIEW_COUNT" | "TITLE";
  sortDirection: "ASC" | "DESC";
}

export interface DocumentListItem {
  documentId: number;
  documentTitle: string;
  documentStatus: DocumentStatus;
  thumbnailFileId?: number;
  thumbnailImageUrl?: string;
  versionNumber: number;
  viewCount: number;
  authorId: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageInformation {
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  firstPage: boolean;
  lastPage: boolean;
}

export interface DocumentListResponse {
  content: DocumentListItem[];
  pageInformation: PageInformation;
}

export interface DocumentDetail {
  documentId: number;
  authorId: number;
  authorName: string;
  documentTitle: string;
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

export interface DocumentFormValues {
  documentTitle: string;
  documentStatus: DocumentStatus;
  changeSummary?: string;
}

export interface DocumentSaveRequest {
  documentTitle: string;
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
  documentStatus: DocumentStatus;
  thumbnailFileId?: number;
  attachmentFileIds: number[];
  versionNumber?: number;
  changeSummary?: string;
}
