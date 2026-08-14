import type { JSONContent } from "@tiptap/core";

export type PortfolioSectionType = "PROFILE" | "RICH_TEXT" | "EXPERIENCE" | "PROJECT" | "SKILL";
export type PortfolioContentMode = "STRUCTURED" | "RICH_TEXT" | "HYBRID";
export type PortfolioVisibility = "PUBLIC" | "HIDDEN";

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
  versionNumber: number;
  editorImageFileIds: number[];
  createdAt: string;
  updatedAt: string;
}

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
  versionNumber?: number;
}

