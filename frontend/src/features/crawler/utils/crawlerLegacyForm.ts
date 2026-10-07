/**
 * [LEGACY-FORM] 기존 설정 방식(로그인 설정 → 사이트 검색 → 목록 수집)의 입력값.
 * 단계별 실행으로 옮기고 저장 설정 마이그레이션을 마련하면 이 파일과 CrawlerLegacyFormFields를 함께 삭제한다.
 */
import type {
  CrawlerLoginMode,
  CrawlerLoginRequest,
  CrawlerPageSearchRequest,
  CrawlerRunRequest,
} from "@/features/crawler/types/webCrawlerTypes";

/** 계정정보(username, password)는 단계별 실행의 {{username}}·{{password}}에도 쓰므로 여기에 두지 않는다. */
export interface CrawlerLegacyForm {
  loginEnabled: boolean;
  preferSavedSession: boolean;
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  loggedInSelector: string;
  pageSearchEnabled: boolean;
  pageSearchKeyword: string;
  searchInputSelector: string;
  searchSubmitSelector: string;
}

export const initialCrawlerLegacyForm: CrawlerLegacyForm = {
  loginEnabled: false,
  preferSavedSession: true,
  loginUrl: "",
  usernameSelector: "input[name=username]",
  passwordSelector: "input[name=password]",
  submitSelector: "button[type=submit]",
  loggedInSelector: "",
  pageSearchEnabled: false,
  pageSearchKeyword: "",
  searchInputSelector: "",
  searchSubmitSelector: "",
};

export const naverCafeLegacyForm: CrawlerLegacyForm = {
  loginEnabled: true,
  preferSavedSession: true,
  loginUrl: "https://nid.naver.com/nidlogin.login?mode=form",
  usernameSelector: "#id",
  passwordSelector: "#pw",
  submitSelector: "#log\\.login, button.btn_login",
  loggedInSelector: "",
  pageSearchEnabled: true,
  pageSearchKeyword: "",
  // 네이버 카페 화면 개편에 영향받지 않도록 검색창은 자동 탐색한다(왼쪽 '카페글 검색어 입력' 칸).
  searchInputSelector: "",
  searchSubmitSelector: "",
};

/** 저장된 실행 요청 → 폼 입력값(설정을 불러올 때). */
export const toCrawlerLegacyForm = (request: CrawlerRunRequest): CrawlerLegacyForm => ({
  loginEnabled: request.login.mode !== "NONE",
  preferSavedSession: request.login.mode === "SAVED_SESSION",
  loginUrl: request.login.loginUrl,
  usernameSelector: request.login.usernameSelector,
  passwordSelector: request.login.passwordSelector,
  submitSelector: request.login.submitSelector,
  loggedInSelector: request.login.loggedInSelector,
  pageSearchEnabled: request.pageSearch.enabled,
  pageSearchKeyword: request.pageSearch.keyword,
  searchInputSelector: request.pageSearch.inputSelector,
  searchSubmitSelector: request.pageSearch.submitSelector,
});

interface LegacyCredentials {
  useSavedSession: boolean;
  username: string;
  password: string;
}

// 결과 타입: 검사를 통과하면 { valid: true, 요청 조각 }, 아니면 { valid: false, 안내 문구 }. valid로 어느 쪽인지 TypeScript가 구분한다.
export type CrawlerLegacyRequestParts =
  | { valid: true; login: CrawlerLoginRequest; pageSearch: CrawlerPageSearchRequest }
  | { valid: false; message: string };

const loginModeOf = (form: CrawlerLegacyForm, useSavedSession: boolean): CrawlerLoginMode => {
  if (!form.loginEnabled) return "NONE";
  return useSavedSession ? "SAVED_SESSION" : "FORM";
};

/**
 * 폼 입력값 → 서버 요청의 login·pageSearch 부분. 필요한 칸이 비었으면 실패 결과를 돌려준다.
 * 쓰지 않는 기능의 칸(로그인 끔, 검색 끔)은 빈 문자열로 보내, 예전에 입력했던 값이 섞여 저장되지 않게 한다.
 */
export const buildCrawlerLegacyRequestParts = (
  form: CrawlerLegacyForm,
  { useSavedSession, username, password }: LegacyCredentials,
): CrawlerLegacyRequestParts => {
  const formLogin = form.loginEnabled && !useSavedSession;
  const requiredLoginValues = [form.loginUrl, username, password, form.usernameSelector, form.passwordSelector, form.submitSelector];
  if (formLogin && requiredLoginValues.some((value) => !value.trim())) {
    return { valid: false, message: "폼 로그인에 필요한 URL, 계정정보, 선택자를 모두 입력해 주세요." };
  }
  if (form.pageSearchEnabled && !form.pageSearchKeyword.trim()) {
    return { valid: false, message: "사이트 검색어를 입력해 주세요." };
  }
  return {
    valid: true,
    login: {
      mode: loginModeOf(form, useSavedSession),
      loginUrl: formLogin ? form.loginUrl.trim() : "",
      username: formLogin ? username : "",
      password: formLogin ? password : "",
      usernameSelector: formLogin ? form.usernameSelector.trim() : "",
      passwordSelector: formLogin ? form.passwordSelector.trim() : "",
      submitSelector: formLogin ? form.submitSelector.trim() : "",
      loggedInSelector: formLogin ? form.loggedInSelector.trim() : "",
    },
    pageSearch: {
      enabled: form.pageSearchEnabled,
      keyword: form.pageSearchEnabled ? form.pageSearchKeyword.trim() : "",
      inputSelector: form.pageSearchEnabled ? form.searchInputSelector.trim() : "",
      submitSelector: form.pageSearchEnabled ? form.searchSubmitSelector.trim() : "",
    },
  };
};
