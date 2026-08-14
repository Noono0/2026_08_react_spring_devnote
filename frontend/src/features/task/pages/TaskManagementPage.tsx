import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localTaskApi } from "../api/localTaskApi";
import type { TaskItem, TaskPriority, TaskSaveRequest, TaskStatus } from "../types/taskTypes";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const taskStatusLabelMap: Record<TaskStatus, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
};

export const TaskManagementPage = () => {
  const queryClient = useQueryClient();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeName, setAssigneeName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const taskListQuery = useQuery({
    queryKey: ["practiceTasks"],
    queryFn: () => localTaskApi.getTaskList(),
  });

  const createTaskMutation = useMutation({
    mutationFn: (saveRequest: TaskSaveRequest) => localTaskApi.createTask(saveRequest),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["practiceTasks"] });
      applicationNotification.success("업무를 등록했습니다.");
      setTaskTitle("");
      setTaskDescription("");
      setAssigneeName("");
      setDueDate("");
    },
    onError: (mutationError) => applicationNotification.error(
      "업무 등록에 실패했습니다.",
      mutationError instanceof Error ? mutationError.message : undefined,
    ),
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, taskStatus }: { taskId: number; taskStatus: TaskStatus }) =>
      localTaskApi.updateTaskStatus(taskId, taskStatus),
    onMutate: async ({ taskId, taskStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["practiceTasks"] });
      const previousTaskItems = queryClient.getQueryData(["practiceTasks"]);
      queryClient.setQueryData(["practiceTasks"], (currentTaskItems: TaskItem[] | undefined) =>
        currentTaskItems?.map((taskItem) => taskItem.taskId === taskId ? { ...taskItem, taskStatus } : taskItem),
      );
      return { previousTaskItems };
    },
    onError: (_mutationError, _variables, mutationContext) => {
      queryClient.setQueryData(["practiceTasks"], mutationContext?.previousTaskItems);
      applicationNotification.error("업무 상태 변경을 되돌렸습니다.");
    },
    onSettled: async () => queryClient.invalidateQueries({ queryKey: ["practiceTasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => localTaskApi.deleteTask(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["practiceTasks"] });
      applicationNotification.success("업무를 삭제했습니다.");
    },
  });

  const submitTask = (): void => {
    if (!taskTitle.trim() || !assigneeName.trim() || !dueDate) {
      applicationNotification.warning("제목, 담당자, 마감일을 입력해 주세요.");
      return;
    }
    const taskSaveRequest: TaskSaveRequest = {
      taskTitle: taskTitle.trim(),
      taskDescription: taskDescription.trim(),
      taskPriority,
      assigneeName: assigneeName.trim(),
      dueDate,
    };
    createTaskMutation.mutate(taskSaveRequest);
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-중급">중급</span>
          <h1>비동기 업무 관리 CRUD</h1>
          <p>가짜 비동기 API로 로딩, Mutation, 캐시 무효화, 낙관적 업데이트와 롤백을 연습합니다.</p>
        </div>
      </div>

      <div className="split-practice-layout task-layout">
        <article className="practice-card sticky-form-card">
          <h2>업무 등록</h2>
          <label>업무 제목<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="error 포함 시 실패 재현" /></label>
          <label>설명<textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={4} /></label>
          <label>우선순위
            <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}>
              <option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option>
            </select>
          </label>
          <label>담당자<input value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} /></label>
          <label>마감일<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <button type="button" onClick={submitTask} disabled={createTaskMutation.isPending}>
            {createTaskMutation.isPending ? "등록 중..." : "업무 등록"}
          </button>
        </article>

        <div>
          {taskListQuery.isPending ? <div className="state-panel">업무 목록을 불러오는 중입니다.</div> : null}
          {taskListQuery.isError ? <div className="state-panel error-state">업무 목록 조회에 실패했습니다.</div> : null}
          <div className="task-board">
            {(Object.keys(taskStatusLabelMap) as TaskStatus[]).map((taskStatus) => (
              <section className="task-column" key={taskStatus}>
                <h2>{taskStatusLabelMap[taskStatus]}</h2>
                {taskListQuery.data?.filter((taskItem) => taskItem.taskStatus === taskStatus).map((taskItem) => (
                  <article className="task-card" key={taskItem.taskId}>
                    <div className="task-card-heading">
                      <strong>{taskItem.taskTitle}</strong>
                      <span className={`priority-badge priority-${taskItem.taskPriority.toLowerCase()}`}>{taskItem.taskPriority}</span>
                    </div>
                    <p>{taskItem.taskDescription || "설명 없음"}</p>
                    <dl>
                      <dt>담당자</dt><dd>{taskItem.assigneeName}</dd>
                      <dt>마감일</dt><dd>{taskItem.dueDate}</dd>
                    </dl>
                    <label>상태 변경
                      <select
                        value={taskItem.taskStatus}
                        onChange={(event) => updateTaskStatusMutation.mutate({ taskId: taskItem.taskId, taskStatus: event.target.value as TaskStatus })}
                      >
                        {(Object.keys(taskStatusLabelMap) as TaskStatus[]).map((statusOption) => (
                          <option key={statusOption} value={statusOption}>{taskStatusLabelMap[statusOption]}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="danger-button" onClick={() => deleteTaskMutation.mutate(taskItem.taskId)}>삭제</button>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
