/**
 * ============================================================================
 * pageTitle.ts — 주소로 브라우저 탭 제목 계산하기
 * ============================================================================
 *
 * 탭을 여러 개 열어 두거나 즐겨찾기·방문 기록에서 찾을 때 "DevNote Portfolio"만 보이면 구분이 안 된다.
 * 주소가 바뀔 때마다 "API Workspace | DevNote"처럼 현재 화면 이름을 탭 제목에 넣는다.
 *
 * [제목은 어디서 가져오나?]
 *   새 목록을 또 만들지 않고 이미 있는 데이터를 쓴다. (같은 정보를 두 곳에 두지 않기)
 *     /react/...      → 학습 가이드 제목 (learningGuides.ts)
 *     그 밖의 주소    → 사이드바 메뉴 이름 (navigationGroups.ts)
 */

import {
  administratorNavigationGroup,
  portfolioNavigationGroup,
  reactNavigationGroup,
  utilityNavigationGroup,
} from "@/app/navigation/navigationGroups";
import { findLearningGuideByPathname } from "@/features/curriculum/data/learningGuides";

const SITE_NAME = "DevNote";
const HOME_TITLE = "DevNote Portfolio";

const navigationItems = [portfolioNavigationGroup, reactNavigationGroup, utilityNavigationGroup, administratorNavigationGroup]
  .flatMap((navigationGroup) => navigationGroup.items);

/** 주소에 가장 잘 맞는 화면 이름. 못 찾으면 undefined */
export const resolvePageName = (pathname: string): string | undefined => {
  if (pathname === "/") return undefined;
  if (pathname.startsWith("/projects/")) return "프로젝트 상세";
  if (pathname === "/react" || pathname.startsWith("/react/")) {
    const learningGuide = findLearningGuideByPathname(pathname);
    if (learningGuide) return learningGuide.title;
  }
  // 정확히 같은 주소, 또는 "가장 긴" 상위 주소를 고른다.
  //   /utilities/api-workspace/mock → "/utilities"보다 "/utilities/api-workspace/mock"이 더 정확하다.
  const matchedItems = navigationItems.filter((navigationItem) => navigationItem.route
    && navigationItem.route !== "/"
    && (pathname === navigationItem.route || pathname.startsWith(`${navigationItem.route}/`)));
  matchedItems.sort((left, right) => (right.route?.length ?? 0) - (left.route?.length ?? 0));
  return matchedItems[0]?.label;
};

export const createDocumentTitle = (pathname: string): string => {
  const pageName = resolvePageName(pathname);
  return pageName ? `${pageName} | ${SITE_NAME}` : HOME_TITLE;
};
