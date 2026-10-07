/**
 * portfolioTypes.ts — 포트폴리오 섹션 타입
 *
 * ★ 서버 PortfolioSectionResponse·PortfolioSectionSaveRequest(Java record)와 필드 이름·값이 같아야 한다.
 *   한쪽만 바꾸면 화면에 값이 비어 보이거나 저장 요청이 400으로 거부된다.
 * JSONContent: Tiptap 에디터 본문의 JSON 구조 타입.
 */

import type { JSONContent } from "@tiptap/core";

// 섹션 종류. 종류마다 홈 화면 카드 모양이 다르다(portfolioSectionPresentation.ts).
export type PortfolioSectionType =
  | "PROFILE"
  | "RICH_TEXT"
  | "IMAGE"
  | "SKILL"
  | "EXPERIENCE"
  | "PROJECT"
  | "EDUCATION"
  | "CERTIFICATE"
  | "CONTACT";
export type PortfolioContentMode = "STRUCTURED" | "RICH_TEXT" | "HYBRID";
export type PortfolioVisibility = "PUBLIC" | "HIDDEN";

/** 서버에서 받은 섹션(응답). ?가 붙은 필드는 값이 없을 수 있다(서버 null → JSON에서 생략 또는 null). */
export interface PortfolioSection {
  portfolioSectionId: number;
  sectionType: PortfolioSectionType;
  contentMode: PortfolioContentMode;
  sectionTitle: string;
  sectionSubtitle?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  externalUrl?: string;
  thumbnailFileId?: number;
  thumbnailImageUrl?: string;
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
  layoutType: string;
  sortOrder: number;
  visibility: PortfolioVisibility;
  /** 낙관적 잠금용 버전. 수정·삭제 요청에 그대로 다시 보낸다. */
  versionNumber: number;
  editorImageFileIds: number[];
  /** PROJECT 섹션의 기술 스택. 다른 섹션은 빈 배열이다. */
  techStack: string[];
  roleSummary?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** 추가·수정 요청 본문. versionNumber는 수정할 때만 보낸다. */
export interface PortfolioSectionSaveRequest {
  sectionType: PortfolioSectionType;
  contentMode: PortfolioContentMode;
  sectionTitle: string;
  sectionSubtitle?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  externalUrl?: string;
  thumbnailFileId?: number;
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
  layoutType: string;
  sortOrder: number;
  visibility: PortfolioVisibility;
  editorImageFileIds: number[];
  techStack: string[];
  roleSummary?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  versionNumber?: number;
}
