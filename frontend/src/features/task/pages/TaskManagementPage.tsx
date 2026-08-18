/**
 * ============================================================================
 * TaskManagementPage.tsx — 【중급】 TanStack Query 입문 (서버 상태 다루기)
 * ============================================================================
 *
 * ★★ 이 페이지가 이 프로젝트의 큰 분기점이다.
 *   여기까지는 데이터를 useState에 직접 담아 관리했다.
 *   지금부터는 "서버에 있는 데이터"를 다루는 방법을 배운다.
 *
 * [왜 서버 데이터는 useState로 관리하면 안 되나?]
 *   서버 데이터를 useState + useEffect로 다루려면 이걸 전부 직접 만들어야 한다.
 *     - 로딩 중인지 나타내는 State
 *     - 오류가 났는지 나타내는 State
 *     - 데이터를 담는 State
 *     - 화면을 떠났을 때 요청 취소하기
 *     - 같은 데이터를 여러 화면에서 쓸 때 중복 요청 막기
 *     - 데이터를 수정한 뒤 목록 다시 불러오기
 *     - 캐싱, 재시도, 오래된 데이터 갱신…
 *   컴포넌트마다 이걸 반복하면 코드가 폭발한다.
 *
 *   TanStack Query는 이 전부를 대신해 준다.
 *
 * [핵심 개념 두 가지]
 *   useQuery    → 데이터를 "읽을" 때 (GET). 자동 캐싱, 로딩/오류 상태 제공.
 *   useMutation → 데이터를 "바꿀" 때 (POST/PUT/DELETE). 성공/실패 후처리 제공.
 *
 * [이 페이지에서 배울 것]
 *   1. useQuery로 목록 불러오기 + isPending / isError 상태 처리
 *   2. useMutation으로 등록/수정/삭제
 *   3. queryKey와 invalidateQueries (캐시 무효화)
 *   4. ★ 낙관적 업데이트(Optimistic Update)와 실패 시 롤백  ← 가장 어렵고 중요
 *
 * [연습 방법]
 *   업무 제목에 "error"를 넣고 등록해 보자. 일부러 실패한다.
 *   상태 변경 중에도 실패 상황을 만들어 롤백이 동작하는지 확인해 보자.
 */

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
  // ★ queryClient = 캐시 창고를 직접 조작하는 리모컨.
  //   ApplicationProviders.tsx에서 만들어 앱 전체에 뿌린 그 창고를 꺼내 온 것이다.
  //   "목록을 다시 불러와라(invalidate)", "캐시를 이 값으로 바꿔라(setQueryData)"
  //   같은 명령을 내릴 때 쓴다.
  const queryClient = useQueryClient();

  // 아래 입력칸들은 여전히 useState다.
  // ★ 서버 데이터(업무 목록)는 Query가, 화면 입력값은 useState가 관리한다.
  //   이 구분이 "서버 상태 vs 클라이언트 상태"의 핵심이다.
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeName, setAssigneeName] = useState("");
  const [dueDate, setDueDate] = useState("");

  // ── 【Read】 useQuery로 목록 불러오기 ──────────────────────────
  //
  // 딱 두 가지만 알려주면 나머지는 전부 알아서 해 준다.
  //
  //   queryKey : 이 데이터의 "이름표". 캐시 창고에서 이 키로 저장하고 찾는다.
  //              ★ 배열인 이유: 조건을 덧붙일 수 있게 하기 위해서다.
  //                ["tasks"]                    → 전체 목록
  //                ["tasks", { status: "TODO" }] → 조건이 다르면 다른 캐시
  //                조건이 바뀌면 키가 바뀌고, 키가 바뀌면 자동으로 다시 불러온다.
  //
  //   queryFn  : 실제로 데이터를 가져오는 함수. Promise를 돌려주면 된다.
  //
  // taskListQuery 안에 들어 있는 것들:
  //   .data      → 받아온 데이터 (아직이면 undefined)
  //   .isPending → 처음 불러오는 중인가?
  //   .isError   → 실패했나?
  //   .error     → 실패했다면 그 원인
  //   .refetch() → 수동으로 다시 불러오기
  //
  // ★ useEffect가 한 줄도 없다는 점에 주목하자!
  //   컴포넌트가 화면에 나타나면 알아서 요청하고, 사라지면 알아서 정리한다.
  const taskListQuery = useQuery({
    queryKey: ["practiceTasks"],
    queryFn: () => localTaskApi.getTaskList(),
  });

  // ── 【Create】 useMutation으로 등록 ───────────────────────────
  //
  // ★ useQuery와의 결정적 차이: mutation은 자동으로 실행되지 않는다.
  //   내가 .mutate(값)를 불러야 비로소 실행된다.
  //   당연하다. 화면을 열자마자 데이터가 등록되면 큰일이다.
  const createTaskMutation = useMutation({
    // mutationFn: 실제로 서버를 바꾸는 함수.
    // .mutate(값)로 넘긴 값이 이 함수의 인자로 들어온다.
    mutationFn: (saveRequest: TaskSaveRequest) => localTaskApi.createTask(saveRequest),

    // onSuccess: 성공했을 때 실행된다.
    onSuccess: async () => {
      // ★★ invalidateQueries — TanStack Query에서 가장 자주 쓰는 명령.
      //
      //   "이 키의 캐시는 이제 낡았다. 다시 불러와라"라는 뜻이다.
      //   업무를 하나 등록했으니 목록이 달라졌을 텐데,
      //   이걸 안 하면 화면에는 등록 전 목록이 그대로 남는다.
      //
      //   ★ 왜 직접 목록에 추가하지 않을까?
      //     화면에서 손으로 배열에 넣는 것보다 서버에서 다시 받는 게 확실하다.
      //     서버가 뭔가를 더 계산했을 수도 있고,
      //     그 사이 다른 사람이 등록한 업무도 함께 반영되기 때문이다.
      //     "서버가 진실의 출처(source of truth)"라는 원칙이다.
      await queryClient.invalidateQueries({ queryKey: ["practiceTasks"] });

      applicationNotification.success("업무를 등록했습니다.");
      // 성공했으니 폼을 비운다. 실패했을 때 비우면 사용자가 다시 다 입력해야 한다.
      setTaskTitle("");
      setTaskDescription("");
      setAssigneeName("");
      setDueDate("");
    },

    // onError: 실패했을 때 실행된다.
    // ★ 이걸 안 적으면 실패해도 화면에 아무 반응이 없다.
    //   사용자는 등록 버튼을 계속 누르게 된다.
    //
    // `error instanceof Error ? error.message : undefined`
    //   던져진 값이 Error 객체일 때만 메시지를 꺼낸다.
    //   JavaScript는 문자열이나 숫자도 throw할 수 있어서 확인이 필요하다.
    onError: (mutationError) => applicationNotification.error(
      "업무 등록에 실패했습니다.",
      mutationError instanceof Error ? mutationError.message : undefined,
    ),
  });

  // ══════════════════════════════════════════════════════════════════
  // ★★★ 【Update】 낙관적 업데이트 (Optimistic Update)
  //      이 프로젝트에서 가장 어려운 개념이다. 천천히 읽어 보자.
  // ══════════════════════════════════════════════════════════════════
  //
  // [문제 상황]
  //   업무 상태를 "할 일" → "진행 중"으로 바꾼다고 하자.
  //   보통이라면 이렇게 흘러간다:
  //     1) 사용자가 선택을 바꾼다
  //     2) 서버에 요청을 보낸다
  //     3) 0.65초 기다린다  ← 이 동안 화면은 그대로다!
  //     4) 응답이 오면 목록을 다시 불러온다
  //     5) 드디어 화면이 바뀐다
  //   사용자 입장에서는 "선택했는데 아무 일도 안 일어나네?" 하고 답답하다.
  //
  // [낙관적 업데이트의 아이디어]
  //   "어차피 대부분 성공할 텐데, 성공했다고 치고 화면을 먼저 바꾸자."
  //     1) 사용자가 선택을 바꾼다
  //     2) ★ 화면을 즉시 바꾼다 (캐시를 직접 수정)
  //     3) 뒤에서 조용히 서버에 요청을 보낸다
  //     4-A) 성공하면 → 이미 바뀐 화면이 맞으므로 아무 일도 안 일어난다
  //     4-B) 실패하면 → ★ 원래대로 되돌린다 (롤백)
  //   → 사용자는 즉각 반응하는 빠른 앱이라고 느낀다.
  //
  //   카카오톡에서 메시지를 보내면 즉시 화면에 뜨고,
  //   실패했을 때만 빨간 느낌표가 붙는 것과 똑같은 방식이다.
  //
  // [세 개의 콜백이 순서대로 협력한다]
  //   onMutate  : 요청을 보내기 "직전". 여기서 백업하고 화면을 미리 바꾼다.
  //   onError   : 실패했을 때. 백업해 둔 것으로 되돌린다.
  //   onSettled : 성공이든 실패든 "무조건" 마지막에. 서버와 최종 동기화한다.
  const updateTaskStatusMutation = useMutation({
    // 인자가 두 개 필요할 때는 이렇게 객체로 묶어서 받는다.
    // mutate는 인자를 하나만 받기 때문이다.
    mutationFn: ({ taskId, taskStatus }: { taskId: number; taskStatus: TaskStatus }) =>
      localTaskApi.updateTaskStatus(taskId, taskStatus),

    // ── 1단계: 요청 직전 (onMutate) ──
    onMutate: async ({ taskId, taskStatus }) => {
      // (1) 진행 중인 조회 요청을 취소한다.
      //     ★ 이걸 안 하면?
      //       마침 목록을 다시 불러오는 중이었다면, 그 응답이 나중에 도착해서
      //       우리가 방금 바꿔 놓은 캐시를 옛날 데이터로 덮어써 버린다.
      //       화면이 잠깐 바뀌었다가 되돌아가는 이상한 깜빡임이 생긴다.
      await queryClient.cancelQueries({ queryKey: ["practiceTasks"] });

      // (2) 현재 캐시를 통째로 백업한다.
      //     실패했을 때 이 값으로 되돌릴 것이다.
      const previousTaskItems = queryClient.getQueryData(["practiceTasks"]);

      // (3) ★ 캐시를 직접 수정해서 화면을 즉시 바꾼다.
      //     setQueryData는 "서버에 안 물어보고 캐시만 바꾸는" 명령이다.
      //     안의 map 로직은 지금까지 배운 불변 갱신 패턴과 똑같다.
      //     여기서도 원본을 고치지 않고 새 배열을 만들어 돌려준다.
      queryClient.setQueryData(["practiceTasks"], (currentTaskItems: TaskItem[] | undefined) =>
        currentTaskItems?.map((taskItem) => taskItem.taskId === taskId ? { ...taskItem, taskStatus } : taskItem),
      );

      // (4) ★ 백업을 return한다. 이게 onError의 세 번째 인자로 전달된다.
      //     이 연결 고리가 낙관적 업데이트의 핵심 장치다.
      //     return을 빠뜨리면 실패해도 되돌릴 방법이 없어진다.
      return { previousTaskItems };
    },

    // ── 2단계: 실패했을 때 (onError) ──
    // 매개변수 이름 앞의 `_`는 "이 값은 안 쓴다"는 관례적 표시다.
    // 세 번째 인자를 받으려면 앞의 두 개도 자리를 채워야 해서 이렇게 쓴다.
    onError: (_mutationError, _variables, mutationContext) => {
      // 백업해 둔 값으로 캐시를 되돌린다. → 화면이 원래대로 복구된다.
      queryClient.setQueryData(["practiceTasks"], mutationContext?.previousTaskItems);
      // ★ 되돌렸다는 사실을 반드시 알려야 한다.
      //   조용히 되돌리면 사용자는 자기가 바꾼 게 왜 원래대로인지 알 수 없다.
      applicationNotification.error("업무 상태 변경을 되돌렸습니다.");
    },

    // ── 3단계: 성공이든 실패든 (onSettled) ──
    // 마지막에 서버 데이터로 다시 맞춘다.
    //   성공했어도 → 서버가 뭔가 더 바꿨을 수 있으니 확인차 다시 받는다
    //   실패했어도 → 롤백한 캐시가 진짜 서버 상태와 같은지 확인한다
    // "낙관적으로 보여주되, 마지막엔 반드시 진실과 맞춘다"가 이 패턴의 완성이다.
    onSettled: async () => queryClient.invalidateQueries({ queryKey: ["practiceTasks"] }),
  });

  // ── 【Delete】 삭제 ────────────────────────────────────────────
  // ★ 삭제는 낙관적 업데이트를 안 썼다. 등록과 같은 단순한 방식이다.
  //   왜 다르게 했을까?
  //     상태 변경은 자주 하는 가벼운 조작이라 즉각 반응이 중요하다.
  //     삭제는 되돌릴 수 없는 무거운 조작이라, 화면에서 먼저 지웠다가
  //     실패해서 되살아나면 사용자가 더 불안해진다.
  //   기법을 아는 것과 언제 쓸지 판단하는 것은 다른 문제다.
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
    // ★ .mutate(값) 를 부르는 순간 요청이 시작된다.
    //   여기서 await로 기다리지 않는 점에 주목하자.
    //   결과 처리는 위에서 등록한 onSuccess / onError가 알아서 한다.
    //
    //   ※ 결과를 꼭 여기서 기다려야 한다면 .mutateAsync(값)를 쓴다.
    //     대신 그때는 try/catch로 직접 오류를 잡아야 한다.
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
          {/* ★ mutation의 isPending으로 버튼을 잠근다.
                이걸 안 하면 사용자가 등록 버튼을 연타해서
                같은 업무가 세 개씩 등록되는 사고가 난다.
                문구도 "등록 중..."으로 바꿔 왜 잠겼는지 알려 준다.

                mutation이 알아서 관리해 주는 상태들:
                  .isPending → 요청 중
                  .isError   → 실패함
                  .isSuccess → 성공함
                useState로 이걸 직접 관리하려면 매번 켜고 끄는 코드를 써야 한다. */}
          <button type="button" onClick={submitTask} disabled={createTaskMutation.isPending}>
            {createTaskMutation.isPending ? "등록 중..." : "업무 등록"}
          </button>
        </article>

        <div>
          {/* ★★ 세 가지 상태를 모두 처리하는 것이 데이터 화면의 기본이다.
                  로딩 중 / 실패 / 성공(데이터 표시)
                하나라도 빠뜨리면 사용자는 빈 화면 앞에서 영문을 모른다.

                isPending  → "처음 불러오는 중". 아직 보여줄 데이터가 없다.
                isFetching → "다시 불러오는 중". 옛 데이터는 이미 있다.
                  둘을 구분하면 새로고침 때 화면이 통째로 깜빡이는 걸 막을 수 있다. */}
          {taskListQuery.isPending ? <div className="state-panel">업무 목록을 불러오는 중입니다.</div> : null}
          {taskListQuery.isError ? <div className="state-panel error-state">업무 목록 조회에 실패했습니다.</div> : null}
          {/* ── 칸반 보드 (상태별 세로 열) ─────────────────────────
              Object.keys로 상태 목록을 뽑아 열 세 개를 만들고,
              각 열에서 그 상태의 업무만 걸러 보여준다.
              상태를 하나 추가하면 열도 자동으로 늘어난다. */}
          <div className="task-board">
            {(Object.keys(taskStatusLabelMap) as TaskStatus[]).map((taskStatus) => (
              <section className="task-column" key={taskStatus}>
                <h2>{taskStatusLabelMap[taskStatus]}</h2>
                {/* ★ `taskListQuery.data?.` 에서 `?.`가 꼭 필요하다.
                      로딩 중에는 data가 undefined다.
                      `?.`를 빼면 "undefined의 filter를 부를 수 없다"며 앱이 죽는다.
                      Query를 쓸 때 가장 흔히 겪는 실수다. */}
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
                    {/* ★ 여기가 낙관적 업데이트를 체감할 수 있는 지점이다.
                          선택을 바꾸면 카드가 "즉시" 다른 열로 옮겨 간다.
                          0.65초 지연이 있는데도 기다리는 느낌이 없다.
                          onMutate가 캐시를 미리 바꿔 줬기 때문이다. */}
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
