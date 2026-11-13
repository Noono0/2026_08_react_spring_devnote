import type { JSONContent } from "@tiptap/core";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import { z } from "zod";
import { isCalendarDate } from "./calendarDates";

export const boardTypes = ["GENERAL", "NOTICE", "QNA", "GALLERY", "GRID", "CALENDAR", "POPUP"] as const;
export type BoardType = typeof boardTypes[number];
export const communityCategories = ["GENERAL", "NOTICE", "QNA"] as const;
export type CommunityCategory = typeof communityCategories[number];
export const categoryLabels: Record<CommunityCategory, string> = { GENERAL: "일반", NOTICE: "공지", QNA: "Q&A" };
export const parseCategory = (value: string | null | undefined): CommunityCategory | undefined =>
  communityCategories.find((category) => category === value?.toUpperCase());
export const isCommunityType = (type: BoardType): type is CommunityCategory => communityCategories.some((category) => category === type);
export const boardLabels: Record<BoardType, string> = {
  GENERAL: "일반 게시판", NOTICE: "공지 게시판", QNA: "Q&A 게시판", GALLERY: "갤러리 게시판",
  GRID: "그리드 게시판", CALENDAR: "달력 게시판", POPUP: "팝업 게시판",
};
export const boardDescriptions: Record<BoardType, string> = {
  GENERAL: "로그인 회원이 자유롭게 글을 작성합니다. 작성자와 관리자가 수정·삭제할 수 있습니다.",
  NOTICE: "관리자만 작성·수정·삭제하며, 중요한 공지를 목록 상단에 고정할 수 있습니다.",
  QNA: "회원이 질문하고 관리자가 답변합니다. 답변 대기·완료 상태를 확인할 수 있습니다.",
  GALLERY: "대표 이미지를 필수로 등록하고, 이미지 카드 목록으로 글을 살펴봅니다.",
  GRID: "표의 열 정렬·필터를 사용합니다. 글 작성·수정·삭제 규칙은 일반 게시판과 같습니다.",
  CALENDAR: "시작일~종료일로 기간을 정하고, 기간에 포함된 날짜마다 글을 표시합니다.",
  POPUP: "관리자가 지정한 메뉴 URL과 기간에 제목·본문을 팝업으로 표시합니다.",
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
  eventEndDate: string | null;
  versionNumber?: number;
  popup?: PopupSettings | null;
}
export interface PopupSettings { targetPath: string; includeChildren: boolean; enabled: boolean }
const activePopupSchema = z.object({
  postId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), title: z.string(), contentHtml: z.string(),
  versionNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), endDate: z.string().refine(isCalendarDate),
});
export type ActivePopup = z.infer<typeof activePopupSchema>;
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
  eventEndDate: string | null;
  popup: PopupSettings | null;
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
  async communityList(category: CommunityCategory | undefined, keyword: string, pageNumber: number, signal?: AbortSignal): Promise<BoardPage> {
    const result = await selectedHttpClient.get<ApiResponse<BoardPage>>("/boards/COMMUNITY/posts", {
      queryParameters: { category: category ?? "", keyword, pageNumber, pageSize: 12 }, abortSignal: signal,
    });
    return result.data;
  },
  async activePopups(path: string, signal?: AbortSignal): Promise<ActivePopup[]> {
    const result = await selectedHttpClient.get<ApiResponse<unknown>>("/boards/POPUP/posts/active", {
      queryParameters: { path }, abortSignal: signal,
    });
    return z.array(activePopupSchema).parse(result.data);
  },
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
