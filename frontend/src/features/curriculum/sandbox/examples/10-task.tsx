/**
 * 10단계 연습 — 업무 칸반: TanStack Query의 조회(useQuery)와 낙관적 업데이트·롤백(useMutation)
 *
 * 해 볼 것
 *  1. "실패 모드"를 켜고 상태를 바꿔 보세요. 화면이 먼저 바뀌었다가 원래대로 돌아옵니다(롤백).
 *  2. 업무 삭제 기능을 useMutation으로 추가해 보세요.
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Status = "TODO" | "DOING" | "DONE";
interface Task { id: number; title: string; status: Status; }

// ── 서버 대신 쓰는 가짜 API (0.5초 지연) ──
let serverTasks: Task[] = [
  { id: 1, title: "API 설계", status: "TODO" },
  { id: 2, title: "화면 구현", status: "DOING" },
];
let failNext = false;
const wait = () => new Promise((resolve) => setTimeout(resolve, 500));
const fetchTasks = async (): Promise<Task[]> => { await wait(); return serverTasks; };
const updateTaskStatus = async ({ id, status }: { id: number; status: Status }): Promise<void> => {
  await wait();
  if (failNext) throw new Error("서버 오류(연습용)");
  serverTasks = serverTasks.map((task) => (task.id === id ? { ...task, status } : task));
};

const queryClient = new QueryClient();
const TASKS_KEY = ["tasks"];

function Board() {
  const client = useQueryClient();
  const [failMode, setFailMode] = useState(false);
  const tasksQuery = useQuery({ queryKey: TASKS_KEY, queryFn: fetchTasks });

  const statusMutation = useMutation({
    mutationFn: updateTaskStatus,
    // 1) 요청 전에 화면부터 바꾼다(낙관적 업데이트). 이전 값은 롤백용으로 보관한다.
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: TASKS_KEY });
      const previous = client.getQueryData<Task[]>(TASKS_KEY);
      client.setQueryData<Task[]>(TASKS_KEY, (tasks) => tasks?.map((task) => (task.id === id ? { ...task, status } : task)));
      return { previous };
    },
    // 2) 실패하면 보관해 둔 이전 값으로 되돌린다.
    onError: (_error, _variables, context) => { client.setQueryData(TASKS_KEY, context?.previous); },
    // 3) 성공·실패와 관계없이 서버 값으로 다시 맞춘다.
    onSettled: () => client.invalidateQueries({ queryKey: TASKS_KEY }),
  });

  if (tasksQuery.isPending) return <p>불러오는 중…</p>;
  if (tasksQuery.isError) return <p className="error">목록을 불러오지 못했습니다.</p>;

  return (
    <main>
      <h1>업무 칸반</h1>
      <label className="row"><input type="checkbox" checked={failMode} onChange={(event) => { setFailMode(event.target.checked); failNext = event.target.checked; }} />실패 모드(롤백 확인)</label>
      {statusMutation.isError ? <p className="error" role="alert">변경 실패 → 원래 상태로 되돌렸습니다.</p> : null}
      <div className="row" style={{ alignItems: "flex-start" }}>
        {(["TODO", "DOING", "DONE"] as const).map((column) => (
          <section key={column} className="card" style={{ minWidth: 150 }}>
            <h2>{column}</h2>
            {tasksQuery.data.filter((task) => task.status === column).map((task) => (
              <div key={task.id} className="card">
                <strong>{task.title}</strong>
                <select value={task.status} onChange={(event) => statusMutation.mutate({ id: task.id, status: event.target.value as Status })}>
                  <option>TODO</option><option>DOING</option><option>DONE</option>
                </select>
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}

export default function App() {
  return <QueryClientProvider client={queryClient}><Board /></QueryClientProvider>;
}
