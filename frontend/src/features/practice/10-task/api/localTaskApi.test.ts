import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localTaskApi } from "./localTaskApi";

describe("로컬 업무 저장소", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("깨진 저장 항목을 걸러내고 정상 업무는 보존한다", async () => {
    const task = { taskId: 7, taskTitle: "할 일", taskDescription: "내용", taskStatus: "TODO", taskPriority: "HIGH", assigneeName: "사용자", dueDate: "2026-09-23" };
    localStorage.setItem("practiceTasks", JSON.stringify([null, { ...task, taskTitle: 3 }, task]));
    const result = localTaskApi.getTaskList();
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual([task]);
  });

  it("같은 시각의 연속 생성도 다른 ID를 사용한다", async () => {
    localStorage.setItem("practiceTasks", "[]");
    const request = { taskTitle: "업무", taskDescription: "설명", taskPriority: "LOW" as const, assigneeName: "사용자", dueDate: "2026-09-23" };
    const results = Promise.all([localTaskApi.createTask(request), localTaskApi.createTask(request)]);
    await vi.runAllTimersAsync();
    const tasks = await results;
    expect(new Set(tasks.map((task) => task.taskId)).size).toBe(2);
    const loaded = localTaskApi.getTaskList();
    await vi.runAllTimersAsync();
    await expect(loaded).resolves.toHaveLength(2);
  });
});
