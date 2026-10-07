import { describe, expect, it } from "vitest";
import {
  ADVANCED_TOPIC_FIRST_STAGE_NUMBER,
  findLearningGuideByPathname,
  learningStageRoutes,
  ROADMAP_LAST_STAGE_NUMBER,
  roadmapLearningGuides,
} from "./learningGuides";

describe("learningGuides", () => {
  it("contains ordered React learning stages without gaps", () => {
    expect(roadmapLearningGuides).toHaveLength(ROADMAP_LAST_STAGE_NUMBER);
    expect(new Set(roadmapLearningGuides.map((learningGuide) => learningGuide.guideId)).size).toBe(ROADMAP_LAST_STAGE_NUMBER);
    expect(roadmapLearningGuides.map((learningGuide) => learningGuide.stageNumber))
      .toEqual(Array.from({ length: ROADMAP_LAST_STAGE_NUMBER }, (_, index) => index + 1));
  });

  it("links every roadmap stage to a route whose guide is the same stage", () => {
    roadmapLearningGuides.forEach((learningGuide) => {
      const route = learningStageRoutes[learningGuide.guideId];
      expect(route, learningGuide.guideId).toBeDefined();
      expect(findLearningGuideByPathname(route ?? "")?.guideId).toBe(learningGuide.guideId);
    });
  });

  it("기본 과정(1~14단계)은 뒤 단계로 갈수록 난이도가 낮아지지 않는다", () => {
    const coreStageScores = roadmapLearningGuides
      .filter((learningGuide) => learningGuide.stageNumber < ADVANCED_TOPIC_FIRST_STAGE_NUMBER)
      .map((learningGuide) => learningGuide.difficultyScore);
    // 정렬한 결과와 원래 순서가 같으면 "낮아지는 구간이 없다"는 뜻이다.
    expect(coreStageScores).toEqual([...coreStageScores].sort((left, right) => left - right));
  });

  it("13단계 로컬 관리자 CRUD 다음 14단계에서 실제 API 문서 CRUD로 기본 과정을 마친다", () => {
    expect(findLearningGuideByPathname("/react/admin-users")?.stageNumber).toBe(13);
    expect(findLearningGuideByPathname("/react/documents")?.stageNumber).toBe(14);
    expect(ADVANCED_TOPIC_FIRST_STAGE_NUMBER).toBe(15);
  });

  it("resolves route-specific guides", () => {
    expect(findLearningGuideByPathname("/practice/gallery")?.guideId).toBe("gallery");
    expect(findLearningGuideByPathname("/practice/reservations")?.guideId).toBe("reservation");
    expect(findLearningGuideByPathname("/practice/search-autocomplete")?.guideId).toBe("search");
    expect(findLearningGuideByPathname("/documents/12/edit")?.guideId).toBe("document");
    expect(findLearningGuideByPathname("/react/context-auth/mypage")?.guideId).toBe("context-auth");
  });
});
