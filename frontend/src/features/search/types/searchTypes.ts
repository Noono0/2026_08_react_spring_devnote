export type SearchPracticeScenario = "success" | "slow" | "empty" | "error";

export interface LearningTopicSearchResult {
  topicId: number;
  topicTitle: string;
  categoryName: string;
  description: string;
  keywords: string[];
}

