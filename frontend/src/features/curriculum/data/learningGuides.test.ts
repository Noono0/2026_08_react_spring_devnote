import { describe, expect, it } from "vitest";
import { findLearningGuideByPathname, learningGuideList } from "./learningGuides";

describe("learningGuides", () => {
  it("contains fourteen ordered React learning stages", () => {
    const roadmapStages = learningGuideList.filter((learningGuide) => learningGuide.stageNumber >= 1 && learningGuide.stageNumber <= 14);
    expect(roadmapStages).toHaveLength(14);
    expect(new Set(roadmapStages.map((learningGuide) => learningGuide.guideId)).size).toBe(14);
    expect(roadmapStages.map((learningGuide) => learningGuide.stageNumber)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
  });

  it("resolves route-specific guides", () => {
    expect(findLearningGuideByPathname("/practice/gallery")?.guideId).toBe("gallery");
    expect(findLearningGuideByPathname("/practice/reservations")?.guideId).toBe("reservation");
    expect(findLearningGuideByPathname("/practice/search-autocomplete")?.guideId).toBe("search");
    expect(findLearningGuideByPathname("/documents/12/edit")?.guideId).toBe("document");
  });
});
