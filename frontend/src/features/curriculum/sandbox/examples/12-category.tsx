/**
 * 12단계 연습 — 카테고리 트리: 재귀 컴포넌트, 하위 추가, 삭제 제한
 *
 * 해 볼 것
 *  1. 같은 부모 안에서 위·아래로 순서를 바꾸는 버튼을 추가해 보세요.
 *  2. 깊이(depth)가 3을 넘으면 "하위 추가"를 막아 보세요.
 */
import { useState } from "react";

interface Category { id: number; parentId: number | null; name: string; }

export default function App() {
  const [categories, setCategories] = useState<Category[]>([
    { id: 1, parentId: null, name: "프론트엔드" },
    { id: 2, parentId: 1, name: "React" },
    { id: 3, parentId: 2, name: "Hooks" },
    { id: 4, parentId: null, name: "백엔드" },
  ]);
  const [message, setMessage] = useState("");

  const childrenOf = (parentId: number | null) => categories.filter((category) => category.parentId === parentId);

  const addChild = (parentId: number | null) => {
    const name = window.prompt("새 카테고리 이름");
    if (!name?.trim()) return;
    setCategories((previous) => [...previous, { id: Date.now(), parentId, name: name.trim() }]);
  };

  // 하위 항목이 있으면 지우지 않는다. 지우면 자식들이 "부모 없는 고아"가 된다.
  const remove = (id: number) => {
    if (childrenOf(id).length > 0) { setMessage("하위 카테고리가 있으면 삭제할 수 없습니다."); return; }
    setCategories((previous) => previous.filter((category) => category.id !== id));
    setMessage("");
  };

  // 재귀 렌더링: 자기 자신(renderNode)을 자식에게 다시 호출한다. 자식이 없으면 멈춘다.
  const renderNode = (category: Category, depth: number) => (
    <li key={category.id} style={{ display: "block", paddingLeft: depth * 16 }}>
      <div className="row">
        <span>{depth > 0 ? "└ " : ""}{category.name}</span>
        <button className="secondary" onClick={() => addChild(category.id)}>하위 추가</button>
        <button className="danger" onClick={() => remove(category.id)}>삭제</button>
      </div>
      <ul className="list">{childrenOf(category.id).map((child) => renderNode(child, depth + 1))}</ul>
    </li>
  );

  return (
    <main>
      <h1>카테고리 트리</h1>
      <button onClick={() => addChild(null)}>최상위 추가</button>
      {message ? <p className="error" role="alert">{message}</p> : null}
      <ul className="list">{childrenOf(null).map((category) => renderNode(category, 0))}</ul>
    </main>
  );
}
