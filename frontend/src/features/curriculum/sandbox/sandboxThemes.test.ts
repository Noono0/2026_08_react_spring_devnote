import { describe, expect, it } from "vitest";
import { createSandboxStyles, isSandboxThemeChoice, resolveSandboxTheme, sandboxEditorThemes, sandboxThemeChoices, sandboxThemeLabels } from "./sandboxThemes";

describe("사이트 안 편집기 색 테마", () => {
  it("모든 선택지에 한국어 이름이 있고, 실제 테마마다 편집기 색이 있다", () => {
    for (const choice of sandboxThemeChoices) {
      expect(sandboxThemeLabels[choice]).not.toBe("");
      if (choice !== "site") expect(sandboxEditorThemes[choice]).toBeDefined();
    }
  });

  it("저장소에서 읽은 값은 아는 테마일 때만 통과시킨다", () => {
    expect(isSandboxThemeChoice("sepia")).toBe(true);
    expect(isSandboxThemeChoice("banana")).toBe(false);
    expect(isSandboxThemeChoice(null)).toBe(false);
  });

  it("'사이트 테마 따라가기'는 사이트 밝게/어둡게 설정을 따른다", () => {
    expect(resolveSandboxTheme("site", "dark")).toBe("dark");
    expect(resolveSandboxTheme("site", "light")).toBe("light");
    expect(resolveSandboxTheme("navy", "light")).toBe("navy");
  });

  it("미리보기 스타일은 배경과 글자 색을 함께 바꾼다", () => {
    const darkStyles = createSandboxStyles("dark");
    expect(darkStyles).toContain("--background: #151a23");
    expect(darkStyles).toContain("--text: #e6ebf2");
    expect(darkStyles).toContain("color-scheme: dark");
    expect(createSandboxStyles("light")).toContain("color-scheme: light");
  });
});
