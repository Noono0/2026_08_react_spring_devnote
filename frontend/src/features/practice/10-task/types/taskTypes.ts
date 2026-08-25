/**
 * ============================================================================
 * taskTypes.ts — 업무(Task) 기능이 쓰는 타입 모음
 * ============================================================================
 *
 * [왜 타입을 별도 파일로 뺐을까?]
 *   지금까지 연습 페이지들은 타입을 페이지 파일 맨 위에 같이 적었다.
 *   그런데 이 기능부터는 파일이 여러 개로 나뉜다.
 *     - 페이지 (TaskManagementPage.tsx)
 *     - API   (localTaskApi.ts)
 *     - 타입   (여기)
 *   페이지와 API가 같은 타입을 써야 하는데, 한쪽에 두면 서로 import하다가
 *   순환 참조가 생기기 쉽다. 그래서 타입만 따로 두는 게 표준 구조다.
 *
 *   이 구조는 뒤에 나오는 document, auth 기능에서도 똑같이 반복된다.
 *   features/기능이름/{api, hooks, pages, types, components}
 */

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

/**
 * 저장되어 있는 업무 하나. (서버에서 받아 오는 모양)
 */
export interface TaskItem {
  taskId: number;
  taskTitle: string;
  taskDescription: string;
  taskStatus: TaskStatus;
  taskPriority: TaskPriority;
  assigneeName: string;
  dueDate: string;  // "2026-08-15" 형식의 문자열
}

/**
 * 업무를 등록할 때 "보내는" 데이터.
 *
 * ★ TaskItem과 비교해 보면 두 가지가 없다.
 *     taskId     → 서버(여기서는 API 함수)가 만들어 붙인다
 *     taskStatus → 새 업무는 무조건 "TODO"로 시작하므로 보낼 필요가 없다
 *
 *   "요청 타입"과 "응답 타입"을 나누는 것은 실무의 기본이다.
 *   하나로 합치면 클라이언트가 taskId를 마음대로 정해서 보낼 수 있게 되고,
 *   그러면 남의 데이터를 덮어쓰는 보안 문제로 이어질 수 있다.
 *
 *   ※ 참고: Omit<TaskItem, "taskId" | "taskStatus"> 라고 써서
 *     TaskItem에서 두 칸을 빼는 방식으로도 만들 수 있다.
 *     여기서는 초보자가 읽기 쉽도록 항목을 그대로 나열했다.
 */
export interface TaskSaveRequest {
  taskTitle: string;
  taskDescription: string;
  taskPriority: TaskPriority;
  assigneeName: string;
  dueDate: string;
}
