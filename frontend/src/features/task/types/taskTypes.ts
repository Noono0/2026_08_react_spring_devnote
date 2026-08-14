export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface TaskItem {
  taskId: number;
  taskTitle: string;
  taskDescription: string;
  taskStatus: TaskStatus;
  taskPriority: TaskPriority;
  assigneeName: string;
  dueDate: string;
}

export interface TaskSaveRequest {
  taskTitle: string;
  taskDescription: string;
  taskPriority: TaskPriority;
  assigneeName: string;
  dueDate: string;
}
