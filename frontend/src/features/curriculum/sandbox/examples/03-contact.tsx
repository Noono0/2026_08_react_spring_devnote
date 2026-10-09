/**
 * 3단계 연습 — 연락처 Reducer CRUD: useReducer와 localStorage(안전한 저장값 읽기)
 *
 * 해 볼 것
 *  1. 즐겨찾기(favorite) 필드를 추가하세요. 타입·스키마·reducer 세 곳을 함께 고쳐야 합니다.
 *  2. 전화번호가 010-0000-0000 형식이 아니면 저장하지 않게 해 보세요.
 */
import { useEffect, useReducer, useState } from "react";
import { z } from "zod";

interface Contact {
  id: number;
  name: string;
  phone: string;
}

// Action = "무엇을 해 달라"는 요청서. type으로 종류를 구분한다(판별 유니온).
type ContactAction =
  | { type: "CREATE"; contact: Contact }
  | { type: "DELETE"; id: number };

// reducer: 상태를 바꾸는 규칙을 한곳에 모은 순수 함수. 같은 입력이면 늘 같은 결과.
const contactReducer = (contacts: Contact[], action: ContactAction): Contact[] => {
  switch (action.type) {
    case "CREATE":
      return [...contacts, action.contact];
    case "DELETE":
      return contacts.filter((contact) => contact.id !== action.id);
  }
};

const STORAGE_KEY = "sandbox-contacts";
const contactListSchema = z.array(z.object({ id: z.number(), name: z.string(), phone: z.string() }));

// localStorage 값은 누구나 고칠 수 있는 "믿을 수 없는 입력"이라 Zod로 모양을 확인한다.
const loadContacts = (): Contact[] => {
  try {
    const parsed = contactListSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    // 깨진 JSON이면 빈 목록으로 시작한다.
    return [];
  }
};

export default function App() {
  // 세 번째 인자(loadContacts)는 처음 한 번만 실행되는 초기값 함수다.
  const [contacts, dispatch] = useReducer(contactReducer, undefined, loadContacts);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // contacts가 바뀔 때마다 저장한다.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  }, [contacts]);

  const save = () => {
    if (!name.trim()) return;
    dispatch({ type: "CREATE", contact: { id: Date.now(), name: name.trim(), phone: phone.trim() } });
    setName("");
    setPhone("");
  };

  return (
    <main>
      <h1>연락처 Reducer CRUD</h1>
      <p>새로고침해도 목록이 남는지 확인해 보세요(localStorage).</p>
      <div className="row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름" />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="010-1234-5678" />
        <button onClick={save}>저장</button>
      </div>
      <ul className="list">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <strong>{contact.name}</strong>
            <span className="muted">{contact.phone}</span>
            <button className="danger" onClick={() => dispatch({ type: "DELETE", id: contact.id })}>삭제</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
