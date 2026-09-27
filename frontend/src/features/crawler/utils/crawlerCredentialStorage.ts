import { z } from "zod";

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
