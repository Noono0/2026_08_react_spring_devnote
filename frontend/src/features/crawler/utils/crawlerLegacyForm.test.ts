import { describe, expect, it } from "vitest";
import {
  buildCrawlerLegacyRequestParts,
  initialCrawlerLegacyForm,
  naverCafeLegacyForm,
  toCrawlerLegacyForm,
  type CrawlerLegacyForm,
} from "@/features/crawler/utils/crawlerLegacyForm";
import type { CrawlerRunRequest } from "@/features/crawler/types/webCrawlerTypes";

const formLogin: CrawlerLegacyForm = {
  ...initialCrawlerLegacyForm,
  loginEnabled: true,
  loginUrl: " https://example.com/login ",
  loggedInSelector: " .profile ",
  pageSearchEnabled: true,
  pageSearchKeyword: " LH ",
  searchInputSelector: " #query ",
};

describe("[LEGACY-FORM] 기존 설정 방식 입력값", () => {
  it("저장된 요청의 로그인 방식과 사이트 검색을 입력값으로 되돌린다", () => {
    const request: CrawlerRunRequest = {
      showBrowser: true, browserWindow: "WEB", steps: [], collectDetail: false, detailSelector: "", parseListing: false,
      startUrl: "https://cafe.naver.com/lhuniv9",
      login: { mode: "SAVED_SESSION", loginUrl: "", username: "", password: "", usernameSelector: "#id", passwordSelector: "#pw", submitSelector: "#login", loggedInSelector: "" },
      pageSearch: { enabled: true, keyword: "LH", inputSelector: "#topLayerQueryInput", submitSelector: "button.search" },
      contentFrameSelector: "", itemSelector: "", fields: [],
      collectionFilter: { groupMatchMode: "ALL", groups: [] },
      nextPageSelector: "", maxPages: 1, waitAfterNavigationMillis: 0, maxItems: 10,
    };

    expect(toCrawlerLegacyForm(request)).toEqual({
      loginEnabled: true,
      preferSavedSession: true,
      loginUrl: "",
      usernameSelector: "#id",
      passwordSelector: "#pw",
      submitSelector: "#login",
      loggedInSelector: "",
      pageSearchEnabled: true,
      pageSearchKeyword: "LH",
      searchInputSelector: "#topLayerQueryInput",
      searchSubmitSelector: "button.search",
    });
  });

  it("폼 로그인에 계정정보가 비어 있으면 요청을 만들지 않는다", () => {
    expect(buildCrawlerLegacyRequestParts(formLogin, { useSavedSession: false, username: "user", password: " " }))
      .toEqual({ valid: false, message: "폼 로그인에 필요한 URL, 계정정보, 선택자를 모두 입력해 주세요." });
  });

  it("사이트 검색을 켰는데 검색어가 없으면 요청을 만들지 않는다", () => {
    expect(buildCrawlerLegacyRequestParts({ ...initialCrawlerLegacyForm, pageSearchEnabled: true }, { useSavedSession: false, username: "", password: "" }))
      .toEqual({ valid: false, message: "사이트 검색어를 입력해 주세요." });
  });

  it("폼 로그인은 URL과 선택자의 공백을 지우고 비밀번호는 그대로 보낸다", () => {
    const parts = buildCrawlerLegacyRequestParts(formLogin, { useSavedSession: false, username: "user", password: " pw " });

    expect(parts).toEqual({
      valid: true,
      login: {
        mode: "FORM", loginUrl: "https://example.com/login", username: "user", password: " pw ",
        usernameSelector: "input[name=username]", passwordSelector: "input[name=password]", submitSelector: "button[type=submit]", loggedInSelector: ".profile",
      },
      pageSearch: { enabled: true, keyword: "LH", inputSelector: "#query", submitSelector: "" },
    });
  });

  it("저장 세션을 쓰면 계정정보와 로그인 선택자를 보내지 않는다", () => {
    const parts = buildCrawlerLegacyRequestParts(
      { ...naverCafeLegacyForm, pageSearchKeyword: "LH" },
      { useSavedSession: true, username: "user", password: "pw" },
    );

    expect(parts.valid && parts.login).toEqual({
      mode: "SAVED_SESSION", loginUrl: "", username: "", password: "",
      usernameSelector: "", passwordSelector: "", submitSelector: "", loggedInSelector: "",
    });
  });

  it("로그인과 사이트 검색을 끄면 남아 있는 입력값을 요청에서 비운다", () => {
    const parts = buildCrawlerLegacyRequestParts(
      { ...formLogin, loginEnabled: false, pageSearchEnabled: false },
      { useSavedSession: false, username: "user", password: "pw" },
    );

    expect(parts.valid && parts.login.mode).toBe("NONE");
    expect(parts.valid && parts.login.username).toBe("");
    expect(parts.valid && parts.pageSearch).toEqual({ enabled: false, keyword: "", inputSelector: "", submitSelector: "" });
  });
});
