import { describe, expect, it } from "vitest";
import { findLearningGuideById, roadmapLearningGuides, type LearningGuide } from "./learningGuides";
import { createCodespacesUrl, createStackBlitzUrl, findPracticeSourceFile } from "./onlinePracticeLinks";

const getGuide = (guideId: string): LearningGuide => {
  const learningGuide = findLearningGuideById(guideId);
  if (!learningGuide) throw new Error(`${guideId} 가이드가 없습니다.`);
  return learningGuide;
};

describe("onlinePracticeLinks", () => {
  it("StackBlitz 주소는 frontend 폴더를 더미 데이터 모드로 열고 단계 파일과 화면을 바로 보여 준다", () => {
    const url = new URL(createStackBlitzUrl(getGuide("todo")));

    expect(url.origin + url.pathname).toBe("https://stackblitz.com/github/Noono0/2026_08_react_spring_devnote/tree/main/frontend");
    expect(url.searchParams.get("startScript")).toBe("dev:online");
    expect(url.searchParams.get("file")).toBe("src/features/practice/02-todo/pages/TodoPracticePage.tsx");
    expect(url.searchParams.get("initialPath")).toBe("/react/todos");
  });

  it("관련 파일 중 폴더·백엔드 경로는 건너뛰고 첫 프론트엔드 소스 파일을 고른다", () => {
    // 14단계의 첫 relatedFile은 폴더(src/.../pages)라서 두 번째 documentApi.ts를 고른다.
    expect(findPracticeSourceFile(getGuide("document"))).toBe("src/features/practice/14-documents/api/documentApi.ts");
  });

  it("모든 로드맵 단계에 열어 볼 소스 파일이 있다", () => {
    roadmapLearningGuides.forEach((learningGuide) => {
      expect(findPracticeSourceFile(learningGuide), learningGuide.guideId).toMatch(/^src\/.+\.tsx?$/);
    });
  });

  it("Codespaces 주소는 같은 저장소의 main 브랜치를 quickstart로 연다", () => {
    expect(createCodespacesUrl()).toBe("https://codespaces.new/Noono0/2026_08_react_spring_devnote?quickstart=1&ref=main");
  });
});
