import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCrawlerCredentials,
  loadCrawlerCredentials,
  saveCrawlerCredentials,
} from "./crawlerCredentialStorage";

describe("crawlerCredentialStorage", () => {
  beforeEach(() => window.localStorage.clear());

  it("사용자가 선택한 계정정보를 저장하고 다시 읽는다", () => {
    saveCrawlerCredentials({ username: "tester", password: "visible-password" });

    expect(loadCrawlerCredentials()).toEqual({ username: "tester", password: "visible-password" });
    clearCrawlerCredentials();
    expect(loadCrawlerCredentials()).toBeNull();
  });

  it("손상되거나 규격이 다른 저장 데이터는 사용하지 않는다", () => {
    window.localStorage.setItem("devnote.crawler.savedCredentials.v1", "not-json");
    expect(loadCrawlerCredentials()).toBeNull();
  });
});
