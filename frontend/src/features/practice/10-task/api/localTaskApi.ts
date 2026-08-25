/**
 * ============================================================================
 * localTaskApi.ts — 진짜 서버인 척하는 "가짜 API"
 * ============================================================================
 *
 * [이 파일의 목적]
 *   백엔드 서버 없이 비동기 프로그래밍을 연습하기 위한 장치다.
 *   실제 데이터는 localStorage에 저장하지만,
 *   함수 모양은 진짜 API와 똑같이 만들었다.
 *     - async 함수라서 await로 기다려야 한다
 *     - 일부러 0.65초를 지연시켜 "네트워크 느낌"을 낸다
 *     - 조건을 만족하면 에러를 던져 실패 상황을 재현한다
 *
 * ★ 이렇게 만들어 두면 나중에 진짜 백엔드가 준비됐을 때
 *   이 파일 내용만 fetch/axios 호출로 바꾸면 된다.
 *   페이지 코드는 한 줄도 안 고쳐도 된다. 아주 중요한 설계 습관이다.
 *
 * [연습해 보기]
 *   업무 제목에 "error"라는 글자를 넣고 등록해 보자.
 *   일부러 실패하도록 만들어 뒀다. 실패했을 때 화면이 어떻게 반응하는지,
 *   낙관적 업데이트가 어떻게 되돌아가는지 확인할 수 있다.
 */

import type { TaskItem, TaskSaveRequest, TaskStatus } from "../types/taskTypes";

const TASK_STORAGE_KEY = "practiceTasks";

// 일부러 넣는 지연 시간.
//
// ★ 왜 일부러 느리게 만들까?
//   로컬 저장소는 너무 빨라서 즉시 끝난다.
//   그러면 로딩 화면이 눈에 보이지도 않아서
//   "로딩 상태를 만들었는데 맞게 동작하는지" 확인할 수가 없다.
//   개발용 컴퓨터는 대체로 빠르지만, 사용자의 환경은 훨씬 느릴 수 있다.
//   지연을 넣어 두면 느린 환경에서의 모습을 미리 확인할 수 있다.
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

/**
 * 지정한 시간만큼 기다린다. (네트워크 지연 흉내)
 *
 * ★ "기다리기"를 만드는 정석 패턴이니 익혀 두면 좋다.
 *
 *   setTimeout은 옛날 방식이라 await로 기다릴 수 없다.
 *   그래서 Promise로 한 겹 감싼다.
 *     new Promise((resolve) => setTimeout(resolve, 시간))
 *
 *   읽는 법: "Promise를 하나 만드는데, 0.65초 뒤에 resolve를 불러서 끝내라."
 *   resolve가 불리는 순간 await가 풀리고 다음 줄이 실행된다.
 *
 *   window.setTimeout이라고 쓴 이유:
 *   그냥 setTimeout이라고 쓰면 TypeScript가 Node.js용 타입과 헷갈릴 수 있다.
 *   window를 붙이면 "브라우저의 그것"임이 분명해진다.
 */
const waitForSimulatedNetwork = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, SIMULATED_NETWORK_DELAY_MILLISECONDS));
};

/** localStorage에서 업무 목록을 읽는다. 없으면 샘플 데이터를 심고 돌려준다. */
const loadTaskItems = (): TaskItem[] => {
  const storedTaskItems = localStorage.getItem(TASK_STORAGE_KEY);
  if (!storedTaskItems) {
    // 첫 방문이면 샘플 데이터를 저장소에 심는다.
    // (진짜 서버라면 DB의 초기 데이터에 해당하는 부분이다)
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(initialTaskItems));
    return initialTaskItems;
  }
  return JSON.parse(storedTaskItems) as TaskItem[];
};

/** 업무 목록을 localStorage에 통째로 덮어쓴다. */
const saveTaskItems = (taskItems: TaskItem[]): void => {
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskItems));
};

/**
 * ★ 연습용 실패 재현 장치.
 *   제목에 "error"가 들어 있으면 일부러 에러를 던진다.
 *
 *   왜 이런 걸 만들까?
 *     실패했을 때의 화면(오류 알림, 롤백, 재시도)을 만들어 놓고도
 *     실패를 재현할 방법이 없으면 제대로 동작하는지 확인할 수 없다.
 *     진짜 서버를 일부러 끄는 것보다 이 방법이 간단하다.
 *
 *   ★ 실패 경로를 테스트하는 습관은 정말 중요하다.
 *     성공했을 때만 확인하고 배포하면, 사용자가 처음으로 오류를 만나는 순간
 *     화면이 하얗게 멈추는 사고가 난다.
 */
const throwWhenFailureRequested = (taskTitle: string): void => {
  if (taskTitle.toLowerCase().includes("error")) {
    throw new Error("연습용 서버 오류가 발생했습니다. 제목에서 error를 제거해 주세요.");
  }
};

/**
 * 바깥에 공개하는 API 묶음.
 * 이 네 함수의 모양이 진짜 REST API와 짝을 이룬다.
 *   getTaskList      ↔ GET    /api/tasks
 *   createTask       ↔ POST   /api/tasks
 *   updateTaskStatus ↔ PATCH  /api/tasks/{id}/status
 *   deleteTask       ↔ DELETE /api/tasks/{id}
 */
export const localTaskApi = {
  async getTaskList(): Promise<TaskItem[]> {
    console.log("[localTaskApi] 업무 목록 조회 요청");
    await waitForSimulatedNetwork();
    return loadTaskItems();
  },

  async createTask(taskSaveRequest: TaskSaveRequest): Promise<TaskItem> {
    console.log("[localTaskApi] 업무 생성 요청", { taskSaveRequest });
    await waitForSimulatedNetwork();
    // ★ 지연 "후에" 검사하는 순서가 중요하다.
    //   진짜 서버라면 요청이 도착해서 처리되는 도중에 오류가 난다.
    //   즉시 에러를 던지면 로딩 상태가 아예 안 보여서 상황이 달라진다.
    throwWhenFailureRequested(taskSaveRequest.taskTitle);

    const taskItems = loadTaskItems();
    // 요청 데이터에 서버가 만드는 값 두 개를 붙여 완성한다.
    const createdTaskItem: TaskItem = {
      ...taskSaveRequest,
      taskId: Date.now(),
      taskStatus: "TODO", // 새 업무는 항상 "할 일"부터 시작
    };
    saveTaskItems([...taskItems, createdTaskItem]);
    // ★ 만들어진 결과를 돌려주는 게 REST의 관례다.
    //   클라이언트가 서버가 붙인 id를 알아야 이후 수정/삭제를 할 수 있다.
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
