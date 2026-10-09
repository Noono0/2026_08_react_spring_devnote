/**
 * 2단계 연습 — 할 일 인라인 CRUD: 배열 State의 추가·수정·삭제와 불변성
 *
 * 해 볼 것
 *  1. "전체 완료" 버튼을 추가하세요. (map으로 모든 항목을 completed: true로)
 *  2. "완료 항목 삭제" 버튼을 추가하세요. (filter로 미완료만 남기기)
 */
import { useState } from "react";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, title: "컴포넌트 역할 확인하기", completed: true },
    { id: 2, title: "배열 불변성 연습하기", completed: false },
  ]);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Create: 새 배열 = 기존 배열 펼치기 + 새 항목
  const createTodo = () => {
    if (!newTitle.trim()) return;
    setTodos((previous) => [...previous, { id: Date.now(), title: newTitle.trim(), completed: false }]);
    setNewTitle("");
  };

  // Update: map으로 바꿀 항목만 새 객체로 교체
  const toggleTodo = (id: number) =>
    setTodos((previous) => previous.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));

  const saveTitle = (id: number) => {
    setTodos((previous) => previous.map((todo) => (todo.id === id ? { ...todo, title: editingTitle.trim() || todo.title } : todo)));
    setEditingId(null);
  };

  // Delete: filter로 지울 항목만 빼고 새 배열
  const deleteTodo = (id: number) => setTodos((previous) => previous.filter((todo) => todo.id !== id));

  return (
    <main>
      <h1>할 일 인라인 CRUD</h1>
      <div className="row">
        <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="할 일을 입력하세요" />
        <button onClick={createTodo}>추가</button>
      </div>
      <ul className="list">
        {todos.map((todo) => (
          <li key={todo.id}>
            <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} aria-label={`${todo.title} 완료`} />
            {editingId === todo.id ? (
              <>
                <input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} />
                <button onClick={() => saveTitle(todo.id)}>저장</button>
                <button className="secondary" onClick={() => setEditingId(null)}>취소</button>
              </>
            ) : (
              <>
                <span style={{ textDecoration: todo.completed ? "line-through" : "none" }}>{todo.title}</span>
                <button className="secondary" onClick={() => { setEditingId(todo.id); setEditingTitle(todo.title); }}>수정</button>
                <button className="danger" onClick={() => deleteTodo(todo.id)}>삭제</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="muted">완료 {todos.filter((todo) => todo.completed).length} / 전체 {todos.length}</p>
    </main>
  );
}
