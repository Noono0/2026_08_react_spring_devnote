import { describe, expect, it } from "vitest";
import { roadmapLearningGuides } from "@/features/curriculum/data/learningGuides";
import { sandboxDependencies } from "./sandboxSetup";
import { stageSandboxSources } from "./stageSandboxes";

describe("stageSandboxes", () => {
  it("로드맵 25단계마다 사이트 안 편집기 예제가 있고, 예제는 App 컴포넌트를 기본으로 내보낸다", () => {
    roadmapLearningGuides.forEach((learningGuide) => {
      const source = stageSandboxSources[learningGuide.guideId];
      expect(source, learningGuide.guideId).toBeDefined();
      // Sandpack react-ts 템플릿의 index.tsx가 "./App"의 기본 내보내기를 그린다.
      expect(source, learningGuide.guideId).toContain("export default function App");
      // 학습자가 무엇부터 할지 알 수 있게 "해 볼 것" 안내를 둔다.
      expect(source, learningGuide.guideId).toContain("해 볼 것");
    });
  });

  it("예제가 import하는 외부 패키지는 모두 편집기 의존성 목록에 있다", () => {
    const importPattern = /from "([^"]+)"/g;
    Object.entries(stageSandboxSources).forEach(([guideId, source]) => {
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? "";
        // "react-dom/client" → "react-dom", "@tanstack/react-query" → 그대로, "zustand/middleware" → "zustand"
        const packageName = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0] ?? "";
        expect(sandboxDependencies[packageName], `${guideId}: ${specifier}`).toBeDefined();
      }
    });
  });
});
