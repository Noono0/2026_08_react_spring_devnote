import type { CrawlerStepType } from "@/features/crawler/types/webCrawlerTypes";

// 단계 종류별 아이콘 모양(SVG path 그리기 명령: M 이동, L/h/v 선, a 호 …). 이미지 파일 없이 코드로 그린다.
const paths: Record<CrawlerStepType | "EXTRACT", string> = {
  GOTO: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18M5 7h14M5 17h14",
  CLICK: "m5 3 14 9-7 1-3 7-4-17Z",
  FILL: "m5 20 7-16 7 16M8 14h8",
  PRESS: "M3 6h18v12H3ZM6 9h1m3 0h1m3 0h1m3 0h1M7 15h10",
  WAIT: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l4 2",
  WAIT_FOR: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 6v6l4 3",
  MANUAL: "M9 5v14M15 5v14",
  COLLECT: "M4 9h15l-4-4M20 15H5l4 4M4 9v5M20 15v-5",
  SCROLL: "M12 3v18m-4-4 4 4 4-4M8 7l4-4 4 4",
  NEXT_PAGE: "m9 4 8 8-8 8",
  CSV: "M5 3h10l4 4v14H5ZM15 3v5h4M8 12h8M8 16h8M12 11v8",
  EXTRACT: "M5 3h10l4 4v14H5ZM15 3v5h4M8 12h8M8 16h6",
};

// stroke="currentColor": 글자색을 그대로 따라가 다크 모드·선택 상태에서도 색이 맞는다. 장식용이라 aria-hidden.
export const CrawlerStepIcon = ({ type }: { type: CrawlerStepType | "EXTRACT" }) => (
  <svg className={`crawler-action-icon icon-${type.toLowerCase()}`} width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[type]} /></svg>
);
