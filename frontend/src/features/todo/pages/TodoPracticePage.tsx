import { useMemo, useState } from "react";
import { applicationLogger } from "@/shared/logging/applicationLogger";
import { applicationNotification } from "@/shared/notification/applicationNotification";

interface TodoItem {
  todoId: number;
  todoTitle: string;
  completed: boolean;
}

type TodoFilter = "ALL" | "ACTIVE" | "COMPLETED";

const initialTodoItems: TodoItem[] = [
  { todoId: 1, todoTitle: "컴포넌트 역할 확인하기", completed: true },
  { todoId: 2, todoTitle: "배열 불변성 연습하기", completed: false },
];

export const TodoPracticePage = () => {
  const [todoItems, setTodoItems] = useState<TodoItem[]>(initialTodoItems);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState("");
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("ALL");

  const filteredTodoItems = useMemo(
    () => todoItems.filter((todoItem) => {
      if (todoFilter === "ACTIVE") return !todoItem.completed;
      if (todoFilter === "COMPLETED") return todoItem.completed;
      return true;
    }),
    [todoFilter, todoItems],
  );

  const createTodo = (): void => {
    const trimmedTodoTitle = newTodoTitle.trim();
    if (!trimmedTodoTitle) {
      applicationNotification.warning("할 일을 입력해 주세요.");
      return;
    }

    const createdTodoItem: TodoItem = {
      todoId: Date.now(),
      todoTitle: trimmedTodoTitle,
      completed: false,
    };

    applicationLogger.info("[TodoPracticePage] 할 일 생성", { createdTodoItem });
    setTodoItems((previousTodoItems) => [...previousTodoItems, createdTodoItem]);
    setNewTodoTitle("");
    applicationNotification.success("할 일을 추가했습니다.");
  };

  const updateTodo = (todoId: number): void => {
    const trimmedTodoTitle = editingTodoTitle.trim();
    if (!trimmedTodoTitle) return;
    setTodoItems((previousTodoItems) => previousTodoItems.map((todoItem) => (
      todoItem.todoId === todoId ? { ...todoItem, todoTitle: trimmedTodoTitle } : todoItem
    )));
    setEditingTodoId(null);
    setEditingTodoTitle("");
    applicationNotification.success("할 일을 수정했습니다.");
  };

  const deleteTodo = (todoId: number): void => {
    applicationLogger.info("[TodoPracticePage] 할 일 삭제", { todoId });
    setTodoItems((previousTodoItems) => previousTodoItems.filter((todoItem) => todoItem.todoId !== todoId));
    applicationNotification.success("할 일을 삭제했습니다.");
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-초급">초급</span>
          <h1>할 일 로컬 CRUD</h1>
          <p>서버 없이 React State 배열을 생성·조회·수정·삭제합니다.</p>
        </div>
      </div>

      <div className="inline-create-form">
        <input
          value={newTodoTitle}
          onChange={(changeEvent) => setNewTodoTitle(changeEvent.target.value)}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Enter") createTodo();
          }}
          placeholder="새 할 일을 입력하세요"
        />
        <button type="button" onClick={createTodo}>추가</button>
      </div>

      <div className="segmented-control" aria-label="할 일 필터">
        {(["ALL", "ACTIVE", "COMPLETED"] as TodoFilter[]).map((filterValue) => (
          <button
            type="button"
            key={filterValue}
            className={todoFilter === filterValue ? "active" : ""}
            onClick={() => setTodoFilter(filterValue)}
          >
            {{ ALL: "전체", ACTIVE: "진행 중", COMPLETED: "완료" }[filterValue]}
          </button>
        ))}
      </div>

      <div className="crud-list">
        {filteredTodoItems.map((todoItem) => (
          <article className="crud-list-item" key={todoItem.todoId}>
            <input
              className="checkbox-input"
              type="checkbox"
              checked={todoItem.completed}
              onChange={() => setTodoItems((previousTodoItems) => previousTodoItems.map((currentTodoItem) => (
                currentTodoItem.todoId === todoItem.todoId
                  ? { ...currentTodoItem, completed: !currentTodoItem.completed }
                  : currentTodoItem
              )))}
              aria-label={`${todoItem.todoTitle} 완료 여부`}
            />

            {editingTodoId === todoItem.todoId ? (
              <input
                value={editingTodoTitle}
                onChange={(changeEvent) => setEditingTodoTitle(changeEvent.target.value)}
                autoFocus
              />
            ) : (
              <span className={todoItem.completed ? "completed-text" : ""}>{todoItem.todoTitle}</span>
            )}

            <div className="button-row compact-button-row">
              {editingTodoId === todoItem.todoId ? (
                <button type="button" onClick={() => updateTodo(todoItem.todoId)}>저장</button>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditingTodoId(todoItem.todoId);
                    setEditingTodoTitle(todoItem.todoTitle);
                  }}
                >
                  수정
                </button>
              )}
              <button type="button" className="danger-button" onClick={() => deleteTodo(todoItem.todoId)}>
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>

      <article className="learning-note-card">
        <h2>연습 포인트</h2>
        <p><code>push</code>나 <code>splice</code>로 기존 배열을 직접 바꾸지 않고 새로운 배열을 만들어 State를 갱신합니다.</p>
      </article>
    </section>
  );
};
