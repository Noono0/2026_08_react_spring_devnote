/**
 * portfolioSectionPresentation.ts — 포트폴리오 섹션을 "어떻게 보여 줄지" 정하는 규칙 모음(순수 함수·상수)
 * 화면 컴포넌트에서 분리해 두면 테스트하기 쉽고, 여러 화면(홈·상세·편집기)이 같은 규칙을 쓴다.
 */

import { parseCommaSeparatedValues } from "@/shared/lib/parseCommaSeparatedValues";
import type {
  PortfolioSection,
  PortfolioSectionSaveRequest,
  PortfolioSectionType,
} from "@/features/portfolio/types/portfolioTypes";

// 블록 선택창에서 고를 수 있는 종류(지금은 모든 섹션 종류와 같다).
export type PortfolioBlockSectionType = PortfolioSectionType;

/** 블록 종류 하나의 안내 정보. anchorId는 페이지 안 이동 주소(#about 등), eyebrow는 제목 위 작은 영문 문구. */
export interface PortfolioSectionGroupDefinition {
  sectionType: PortfolioBlockSectionType;
  anchorId: string;
  eyebrow: string;
  title: string;
  description: string;
  addButtonLabel: string;
}

/**
 * 화면의 순서를 한 곳에서 관리한다.
 *
 * API는 항목 자체의 sortOrder만 책임지고, 어떤 종류의 항목을 어느 영역에
 * 보여줄지는 포트폴리오 화면의 표현 규칙이므로 프론트엔드에 둔다.
 */
export const portfolioSectionGroups: readonly PortfolioSectionGroupDefinition[] = [
  {
    sectionType: "PROFILE",
    anchorId: "about",
    eyebrow: "About me",
    title: "소개",
    description: "어떤 문제를 해결하는 개발자인지 한눈에 전달합니다.",
    addButtonLabel: "소개 추가",
  },
  {
    sectionType: "RICH_TEXT",
    anchorId: "story",
    eyebrow: "Story",
    title: "추가 이야기",
    description: "개발 철학이나 포트폴리오에서 강조하고 싶은 내용을 자유롭게 작성합니다.",
    addButtonLabel: "이야기 추가",
  },
  {
    sectionType: "IMAGE",
    anchorId: "images",
    eyebrow: "Visual",
    title: "이미지",
    description: "화면, 결과물과 작업 과정을 이미지로 보여줍니다.",
    addButtonLabel: "이미지 추가",
  },
  {
    sectionType: "SKILL",
    anchorId: "skills",
    eyebrow: "Skills",
    title: "주요 기술",
    description: "실제 프로젝트에서 사용한 기술과 역할을 분류해 보여줍니다.",
    addButtonLabel: "기술 추가",
  },
  {
    sectionType: "EXPERIENCE",
    anchorId: "experience",
    eyebrow: "Experience",
    title: "경력",
    description: "최근 경험부터 담당 업무, 성과와 문제 해결 과정을 정리합니다.",
    addButtonLabel: "경력 추가",
  },
  {
    sectionType: "PROJECT",
    anchorId: "projects",
    eyebrow: "Selected work",
    title: "주요 프로젝트",
    description: "문제, 해결 과정과 결과를 중심으로 대표 작업을 소개합니다.",
    addButtonLabel: "프로젝트 추가",
  },
  {
    sectionType: "EDUCATION",
    anchorId: "education",
    eyebrow: "Education",
    title: "교육",
    description: "학력과 직무 역량을 키운 교육 과정을 시간순으로 정리합니다.",
    addButtonLabel: "교육 추가",
  },
  {
    sectionType: "CERTIFICATE",
    anchorId: "certificates",
    eyebrow: "Certificates",
    title: "자격·인증",
    description: "자격증, 수료증과 직무 관련 인증을 보여줍니다.",
    addButtonLabel: "자격·인증 추가",
  },
  {
    sectionType: "CONTACT",
    anchorId: "contact",
    eyebrow: "Contact",
    title: "연락처",
    description: "이메일, GitHub와 함께 이야기할 수 있는 채널을 안내합니다.",
    addButtonLabel: "연락처 추가",
  },
] as const;

// 카드 위쪽에 작게 표시하는 종류 이름.
export const portfolioSectionTypeLabels: Record<PortfolioSectionType, string> = {
  PROFILE: "소개",
  RICH_TEXT: "자유 글",
  IMAGE: "이미지",
  SKILL: "기술",
  EXPERIENCE: "경력",
  PROJECT: "프로젝트",
  EDUCATION: "교육",
  CERTIFICATE: "자격·인증",
  CONTACT: "연락처",
};

// 날짜 기준으로 정렬할 종류(경력·교육·자격).
const datedSectionTypes = new Set<PortfolioSectionType>([
  "EXPERIENCE",
  "EDUCATION",
  "CERTIFICATE",
]);

/** 기간 표시: "2024-03-01" → "2024.03". 진행 중이면 끝을 "현재"로. 시작일이 없으면 기간을 표시하지 않는다. */
export const formatPortfolioPeriod = (section: PortfolioSection): string | undefined => {
  if (!section.startDate) return undefined;
  const start = section.startDate.slice(0, 7).replace("-", ".");
  const end = section.current
    ? "현재"
    : section.endDate?.slice(0, 7).replace("-", ".") ?? "";
  return `${start} — ${end}`;
};

/**
 * 종류별 정렬: 날짜가 있는 종류는 진행 중 → 최근 시작 순, 나머지는 사용자가 정한 순서(sortOrder).
 * [...sections]로 복사한 뒤 정렬한다. sort는 원본 배열을 바꾸기 때문에 서버 캐시 배열을 직접 정렬하면 안 된다.
 */
export const sortPortfolioSections = (
  sectionType: PortfolioSectionType,
  sections: PortfolioSection[],
): PortfolioSection[] => [...sections].sort((left, right) => {
  if (datedSectionTypes.has(sectionType)) {
    if (left.current !== right.current) return left.current ? -1 : 1;
    const byStartDate = (right.startDate ?? "").localeCompare(left.startDate ?? "");
    if (byStartDate !== 0) return byStartDate;
  }
  return left.sortOrder - right.sortOrder || left.portfolioSectionId - right.portfolioSectionId;
});

/** 블록형 화면에서는 종류와 관계없이 사용자가 정한 순서를 그대로 따른다. */
export const sortPortfolioBlocks = (sections: PortfolioSection[]): PortfolioSection[] => (
  [...sections].sort((left, right) => (
    left.sortOrder - right.sortOrder || left.portfolioSectionId - right.portfolioSectionId
  ))
);

/** 공개 상태 빠른 전환에서도 에디터 저장과 동일한 API 계약을 사용한다. */
// 응답(PortfolioSection) → 저장 요청으로 바꾼다. 공개 여부·순서만 바꾸고 나머지는 그대로 다시 보낼 때 쓴다(서버 API는 전체 값을 받는다).
export const toPortfolioSectionSaveRequest = (
  section: PortfolioSection,
  changes: Partial<Pick<PortfolioSectionSaveRequest, "visibility" | "sortOrder">> = {},
): PortfolioSectionSaveRequest => ({
  sectionType: section.sectionType,
  contentMode: section.contentMode,
  sectionTitle: section.sectionTitle,
  sectionSubtitle: section.sectionSubtitle,
  startDate: section.startDate,
  endDate: section.endDate,
  current: section.current,
  externalUrl: section.externalUrl,
  thumbnailFileId: section.thumbnailFileId,
  contentJson: section.contentJson,
  contentHtml: section.contentHtml,
  contentText: section.contentText,
  layoutType: section.layoutType,
  sortOrder: changes.sortOrder ?? section.sortOrder,
  visibility: changes.visibility ?? section.visibility,
  editorImageFileIds: section.editorImageFileIds,
  techStack: section.techStack,
  roleSummary: section.roleSummary,
  repositoryUrl: section.repositoryUrl,
  demoUrl: section.demoUrl,
  versionNumber: section.versionNumber,
});

/** "React, spring boot ,React" → ["React", "spring boot"]. 규칙은 업무 History 태그와 같은 공통 함수를 쓴다. */
export const parseTechStackText = (techStackText: string): string[] => parseCommaSeparatedValues(techStackText);

/** 홈 카드에 보여 줄 짧은 요약. 전체 내용은 프로젝트 상세 화면에서 본다. */
export const createSummaryText = (text: string, maxLength = 140): string => {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  return normalizedText.length > maxLength ? `${normalizedText.slice(0, maxLength).trimEnd()}…` : normalizedText;
};

// 프로젝트 상세 화면 주소. 주소 모양을 한 곳에서 정해 링크와 라우트가 어긋나지 않게 한다.
export const portfolioProjectPath = (portfolioSectionId: number): string => `/projects/${portfolioSectionId}`;
