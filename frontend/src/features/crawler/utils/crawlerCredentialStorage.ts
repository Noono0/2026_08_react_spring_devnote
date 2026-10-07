/**
 * crawlerCredentialStorage.ts — 크롤러 로그인 아이디·비밀번호를 이 브라우저에 기억해 두는 기능(사용자가 체크했을 때만)
 *
 * ★ localStorage는 암호화되지 않는다. 같은 PC의 다른 사람이나 이 사이트에서 실행되는 스크립트가 읽을 수 있다.
 *   개인 PC에서 혼자 쓰는 도구라 편의를 위해 둔 기능이며, 공용 PC에서는 쓰지 않는다.
 *   서버 DB에는 저장하지 않는다(CrawlerConfigurationService.withoutCredentials).
 * 읽을 때는 Zod로 모양을 검사하고, 저장소 접근이 막혀도(사생활 보호 모드 등) 화면이 멈추지 않게 try/catch로 감싼다.
 */

import { z } from "zod";

// 키 끝의 v1: 저장 모양이 바뀌면 v2로 바꿔 예전 값과 섞이지 않게 한다.
const CREDENTIAL_STORAGE_KEY = "devnote.crawler.savedCredentials.v1";

const savedCrawlerCredentialsSchema = z.object({
  username: z.string().max(300),
  password: z.string().max(1_000),
});

export interface SavedCrawlerCredentials {
  username: string;
  password: string;
}

export const loadCrawlerCredentials = (): SavedCrawlerCredentials | null => {
  // 테스트·서버 환경처럼 window가 없으면 저장소를 쓰지 않는다.
  if (typeof window === "undefined") return null;
  try {
    const storedValue = window.localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    if (!storedValue) return null;
    const parsed = savedCrawlerCredentialsSchema.safeParse(JSON.parse(storedValue));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveCrawlerCredentials = (credentials: SavedCrawlerCredentials): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // 저장 공간 차단 또는 용량 초과 시에도 크롤링 입력 자체는 계속 사용할 수 있다.
  }
};

export const clearCrawlerCredentials = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  } catch {
    // 브라우저 저장소 접근이 차단된 경우에는 별도 복구 동작이 필요하지 않다.
  }
};
