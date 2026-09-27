import { describe, expect, it } from "vitest";
import { buildCrawlerFailureReport } from "@/features/crawler/utils/crawlerFailureReport";
import type { CrawlerRunRequest } from "@/features/crawler/types/webCrawlerTypes";

const request: CrawlerRunRequest = {
  showBrowser: true,
  browserWindow: "PC_WINDOW",
  steps: [],
  collectDetail: false,
  detailSelector: "",
  parseListing: false,
  startUrl: "https://cafe.naver.com/lhuniv9",
  login: {
    mode: "FORM", loginUrl: "https://nid.naver.com/nidlogin.login?mode=form",
    username: "khe90user", password: "secret-password",
    usernameSelector: "#id", passwordSelector: "#pw", submitSelector: "#log\\.login", loggedInSelector: "",
  },
  pageSearch: { enabled: true, keyword: "LH", inputSelector: "#topLayerQueryInput", submitSelector: "" },
  contentFrameSelector: "iframe#cafe_main",
  itemSelector: "div.article-board tbody tr",
  fields: [{ name: "제목", selector: "a.article", valueSource: "TEXT", attributeName: "" }],
  collectionFilter: { groupMatchMode: "ALL", groups: [] },
  nextPageSelector: "",
  maxPages: 2,
  waitAfterNavigationMillis: 1500,
  maxItems: 100,
};

describe("buildCrawlerFailureReport", () => {
  it("실패 원인·원본 오류와 입력한 값을 가공하지 않고 그대로 담는다", () => {
    const report = buildCrawlerFailureReport({
      problem: {
        status: 502, errorCode: "CRAWLER_EXECUTION_FAILED", detail: "대기 시간을 초과했습니다.",
        crawlerStage: "사이트 검색 실행", suggestedAction: "검색 버튼 선택자를 확인해 주세요.", fieldErrors: [],
        technicalMessage: "Timeout 15000ms exceeded.\nCall log:\n  - waiting for locator(\"#topLayerQueryInput\")",
      },
      request,
      sitePreset: "NAVER_CAFE",
      occurredAt: new Date(2026, 8, 20, 21, 3, 11),
      pageUrl: "http://localhost:5173/utilities/crawler",
    });

    expect(report).toContain("- 실패 단계: 사이트 검색 실행");
    expect(report).toContain("- 실패 이유: 대기 시간을 초과했습니다.");
    expect(report).toContain("내 PC 새 창(PC_WINDOW)");
    expect(report).toContain('- 아이디: "khe90user"');
    expect(report).toContain('- 비밀번호: "secret-password"');
    expect(report).toContain("    Timeout 15000ms exceeded.");
    expect(report).toContain('waiting for locator("#topLayerQueryInput")');
  });

  it("서버가 단계를 알려주지 않으면 시작 전 실패라고 안내한다", () => {
    const report = buildCrawlerFailureReport({
      problem: { status: 500, errorCode: "HTTP_500", fieldErrors: [] },
    });

    expect(report).toContain("크롤링 시작 전 또는 서버 연결 단계에서 실패");
    expect(report).toContain("(입력값 정보 없음)");
  });
});
