import type { JSONContent } from "@tiptap/core";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";

export const boardTypes = ["GENERAL", "NOTICE", "QNA", "GALLERY", "GRID", "CALENDAR"] as const;
export type BoardType = typeof boardTypes[number];
export const boardLabels: Record<BoardType, string> = {
  GENERAL: "일반 게시판", NOTICE: "공지 게시판", QNA: "Q&A 게시판", GALLERY: "갤러리 게시판",
  GRID: "그리드 게시판", CALENDAR: "달력 게시판",
};

export const parseBoardType = (value: string | undefined): BoardType | undefined =>
  boardTypes.find((type) => type.toLowerCase() === value?.toLowerCase());

export interface EditorContentValue {
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
}
export interface BoardPostInput extends EditorContentValue {
  title: string;
  imageFileId: number | null;
  pinned: boolean;
  eventDate: string | null;
  versionNumber?: number;
}
export interface BoardPostSummary {
  postId: number;
  boardType: BoardType;
  title: string;
  authorName: string;
  contentPreview: string;
  pinned: boolean;
  answered: boolean;
  imageFileId: number | null;
  viewCount: number;
  createdAt: string;
  eventDate: string | null;
}
export interface BoardAnswer {
  answerId: number;
  contentJson: JSONContent;
  contentHtml: string;
  authorName: string;
  createdAt: string;
}
export interface BoardPost extends BoardPostSummary, EditorContentValue {
  contentText: string;
  versionNumber: number;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
  canAnswer: boolean;
  answer: BoardAnswer | null;
}
export interface BoardPage {
  content: BoardPostSummary[];
  pageInformation: { pageNumber: number; pageSize: number; totalElements: number; totalPages: number; firstPage: boolean; lastPage: boolean };
}
export interface CalendarMonth { content: BoardPostSummary[]; truncated: boolean }

const basePath = (type: BoardType) => `/boards/${type}/posts`;
const postPath = (type: BoardType, id: number) => `${basePath(type)}/${id}`;

export const boardApi = {
  async list(type: BoardType, keyword: string, pageNumber: number, signal?: AbortSignal): Promise<BoardPage> {
    const result = await selectedHttpClient.get<ApiResponse<BoardPage>>(basePath(type), {
      queryParameters: { keyword, pageNumber, pageSize: type === "GRID" ? 50 : 12 }, abortSignal: signal,
    });
    return result.data;
  },
  async calendarMonth(month: string, keyword: string, signal?: AbortSignal): Promise<CalendarMonth> {
    const result = await selectedHttpClient.get<ApiResponse<CalendarMonth>>(`${basePath("CALENDAR")}/calendar`, {
      queryParameters: { month, keyword }, abortSignal: signal,
    });
    return result.data;
  },
  async detail(type: BoardType, id: number, signal?: AbortSignal): Promise<BoardPost> {
    const result = await selectedHttpClient.get<ApiResponse<BoardPost>>(postPath(type, id), { abortSignal: signal });
    return result.data;
  },
  async create(type: BoardType, input: BoardPostInput): Promise<BoardPost> {
    const result = await selectedHttpClient.post<BoardPostInput, ApiResponse<BoardPost>>(basePath(type), input);
    return result.data;
  },
  async update(type: BoardType, id: number, input: BoardPostInput): Promise<BoardPost> {
    const result = await selectedHttpClient.put<BoardPostInput, ApiResponse<BoardPost>>(postPath(type, id), input);
    return result.data;
  },
  async delete(type: BoardType, id: number): Promise<void> {
    await selectedHttpClient.delete<void>(postPath(type, id));
  },
  async answer(id: number, input: EditorContentValue): Promise<BoardPost> {
    const result = await selectedHttpClient.post<EditorContentValue, ApiResponse<BoardPost>>(
      `${postPath("QNA", id)}/answer`, input,
    );
    return result.data;
  },
  async deleteAnswer(id: number): Promise<void> {
    await selectedHttpClient.delete<void>(`${postPath("QNA", id)}/answer`);
  },
};
