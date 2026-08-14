import type { TaskItem, TaskSaveRequest, TaskStatus } from "../types/taskTypes";

const TASK_STORAGE_KEY = "practiceTasks";
const SIMULATED_NETWORK_DELAY_MILLISECONDS = 650;

const initialTaskItems: TaskItem[] = [
  {
    taskId: 1,
    taskTitle: "문서 검색 화면 구현",
    taskDescription: "URL Search Params와 검색 폼을 연결합니다.",
    taskStatus: "IN_PROGRESS",
    taskPriority: "HIGH",
    assigneeName: "김리액트",
    dueDate: "2026-08-12",
  },
  {
    taskId: 2,
    taskTitle: "SQL 로그 확인",
    taskDescription: "P6Spy 로그에서 실행 SQL과 파라미터를 확인합니다.",
    taskStatus: "TODO",
    taskPriority: "MEDIUM",
    assigneeName: "박스프링",
    dueDate: "2026-08-15",
  },
];

const waitForSimulatedNetwork = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, SIMULATED_NETWORK_DELAY_MILLISECONDS));
};

const loadTaskItems = (): TaskItem[] => {
  const storedTaskItems = localStorage.getItem(TASK_STORAGE_KEY);
  if (!storedTaskItems) {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(initialTaskItems));
    return initialTaskItems;
  }
  return JSON.parse(storedTaskItems) as TaskItem[];
};

const saveTaskItems = (taskItems: TaskItem[]): void => {
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskItems));
};

const throwWhenFailureRequested = (taskTitle: string): void => {
  if (taskTitle.toLowerCase().includes("error")) {
    throw new Error("연습용 서버 오류가 발생했습니다. 제목에서 error를 제거해 주세요.");
  }
};

export const localTaskApi = {
  async getTaskList(): Promise<TaskItem[]> {
    console.log("[localTaskApi] 업무 목록 조회 요청");
    await waitForSimulatedNetwork();
    return loadTaskItems();
  },

  async createTask(taskSaveRequest: TaskSaveRequest): Promise<TaskItem> {
    console.log("[localTaskApi] 업무 생성 요청", { taskSaveRequest });
    await waitForSimulatedNetwork();
    throwWhenFailureRequested(taskSaveRequest.taskTitle);
    const taskItems = loadTaskItems();
    const createdTaskItem: TaskItem = {
      ...taskSaveRequest,
      taskId: Date.now(),
      taskStatus: "TODO",
    };
    saveTaskItems([...taskItems, createdTaskItem]);
    return createdTaskItem;
  },

  async updateTaskStatus(taskId: number, taskStatus: TaskStatus): Promise<TaskItem> {
    console.log("[localTaskApi] 업무 상태 PATCH 요청", { taskId, taskStatus });
    await waitForSimulatedNetwork();
    const taskItems = loadTaskItems();
    const targetTaskItem = taskItems.find((taskItem) => taskItem.taskId === taskId);
    if (!targetTaskItem) throw new Error("수정할 업무를 찾을 수 없습니다.");
    const updatedTaskItem = { ...targetTaskItem, taskStatus };
    saveTaskItems(taskItems.map((taskItem) => taskItem.taskId === taskId ? updatedTaskItem : taskItem));
    return updatedTaskItem;
  },

  async deleteTask(taskId: number): Promise<void> {
    console.log("[localTaskApi] 업무 삭제 요청", { taskId });
    await waitForSimulatedNetwork();
    saveTaskItems(loadTaskItems().filter((taskItem) => taskItem.taskId !== taskId));
  },
};
