/**
 * 11단계 연습 — 문의·답변: 역할(USER·MANAGER·ADMIN)에 따라 보이는 버튼과 허용 동작이 달라진다
 *
 * 해 볼 것
 *  1. 문의 종료를 ADMIN만 할 수 있게 바꿔 보세요. 버튼 숨김과 함수 안 검사를 둘 다 고쳐야 합니다.
 *  2. 비밀글 표시를 추가해, 작성자가 아니면 제목을 가려 보세요.
 */
import { useState } from "react";

type Role = "USER" | "MANAGER" | "ADMIN";
type Status = "WAITING" | "ANSWERED" | "CLOSED";
interface Inquiry { id: number; title: string; answer: string | null; status: Status; }

// 권한 규칙을 한곳에 모은다. 화면은 이 함수 결과로 버튼을 보이거나 숨긴다.
const can = {
  answer: (role: Role) => role !== "USER",
  close: (role: Role) => role !== "USER",
};

export default function App() {
  const [role, setRole] = useState<Role>("USER");
  const [inquiries, setInquiries] = useState<Inquiry[]>([{ id: 1, title: "환불은 어떻게 하나요?", answer: null, status: "WAITING" }]);
  const [answerText, setAnswerText] = useState("");
  const [message, setMessage] = useState("");

  const saveAnswer = (id: number) => {
    // ★ 버튼을 숨겼더라도 함수 안에서 다시 검사한다. 실제 서비스에서는 서버가 최종으로 막는다.
    if (!can.answer(role)) { setMessage("답변 권한이 없습니다."); return; }
    setInquiries((previous) => previous.map((item) => (item.id === id ? { ...item, answer: answerText, status: "ANSWERED" } : item)));
    setAnswerText("");
    setMessage("답변을 저장했습니다.");
  };

  const close = (id: number) => {
    if (!can.close(role)) { setMessage("종료 권한이 없습니다."); return; }
    setInquiries((previous) => previous.map((item) => (item.id === id ? { ...item, status: "CLOSED" } : item)));
  };

  return (
    <main>
      <h1>문의·답변</h1>
      <label>현재 역할
        <select value={role} onChange={(event) => setRole(event.target.value === "ADMIN" ? "ADMIN" : event.target.value === "MANAGER" ? "MANAGER" : "USER")}>
          <option>USER</option><option>MANAGER</option><option>ADMIN</option>
        </select>
      </label>
      {message ? <p className="ok" role="status">{message}</p> : null}
      {inquiries.map((inquiry) => (
        <div key={inquiry.id} className="card">
          <div className="row"><span className="badge">{inquiry.status}</span><strong>{inquiry.title}</strong></div>
          <p>{inquiry.answer ?? "아직 답변이 없습니다."}</p>
          {can.answer(role) && inquiry.status !== "CLOSED" ? (
            <div className="row">
              <input value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder="답변 입력" />
              <button onClick={() => saveAnswer(inquiry.id)}>답변 저장</button>
            </div>
          ) : null}
          {can.close(role) && inquiry.status !== "CLOSED" ? <button className="danger" onClick={() => close(inquiry.id)}>문의 종료</button> : null}
        </div>
      ))}
    </main>
  );
}
