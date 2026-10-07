import { beforeEach, describe, expect, it } from "vitest";
import {
  LEARNING_PROGRESS_STORAGE_KEY,
  createTaskProgressKey,
  useLearningProgressStore,
} from "./learningProgressStore";

beforeEach(() => {
  localStorage.clear();
  useLearningProgressStore.setState({ completedStageIds: [], completedTaskKeys: [] });
});

describe("learningProgressStore", () => {
  it("단계와 과제 완료를 토글하고 localStorage에 저장한다", () => {
    useLearningProgressStore.getState().toggleStageCompleted("todo");
    useLearningProgressStore.getState().toggleTaskCompleted("todo", "전체 완료 버튼을 추가하세요.");

    expect(useLearningProgressStore.getState().completedStageIds).toEqual(["todo"]);
    expect(useLearningProgressStore.getState().completedTaskKeys).toEqual([createTaskProgressKey("todo", "전체 완료 버튼을 추가하세요.")]);
    expect(localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY)).toContain("todo");

    // 다시 누르면 완료가 해제된다.
    useLearningProgressStore.getState().toggleStageCompleted("todo");
    expect(useLearningProgressStore.getState().completedStageIds).toEqual([]);
  });

  it("저장된 값의 모양이 틀리면 버리고 빈 진도로 시작한다", async () => {
    localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify({ state: { completedStageIds: "todo", completedTaskKeys: [1] }, version: 0 }));
    await useLearningProgressStore.persist.rehydrate();
    expect(useLearningProgressStore.getState().completedStageIds).toEqual([]);
    expect(useLearningProgressStore.getState().completedTaskKeys).toEqual([]);

    localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify({ state: { completedStageIds: ["zustand"], completedTaskKeys: [] }, version: 0 }));
    await useLearningProgressStore.persist.rehydrate();
    expect(useLearningProgressStore.getState().completedStageIds).toEqual(["zustand"]);
  });
});
