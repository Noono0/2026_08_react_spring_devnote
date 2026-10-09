/**
 * 18단계 연습 — React 19 Actions: useActionState, useFormStatus, useOptimistic
 *
 * 해 볼 것
 *  1. 내용에 "실패"라고 쓰고 등록해 보세요. 먼저 보였던 글이 사라지고 오류가 나옵니다.
 *  2. 글 삭제도 form action으로 만들어 보세요.
 */
import { useActionState, useOptimistic, useState } from "react";
import { useFormStatus } from "react-dom";

interface Message { id: number; text: string; pending?: boolean; }

// 가짜 서버 저장(0.8초). "실패"가 들어 있으면 오류를 던진다.
const saveMessage = async (text: string): Promise<Message> => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (text.includes("실패")) throw new Error("저장에 실패했습니다(연습용).");
  return { id: Date.now(), text };
};

// useFormStatus: 가장 가까운 <form>이 제출 중인지 알려 준다. 버튼을 따로 컴포넌트로 뺀 이유다.
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "등록 중…" : "등록"}</button>;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([{ id: 1, text: "React 19 Actions 연습" }]);
  // useOptimistic: 액션이 끝날 때까지만 "미리 보여 줄" 목록. 끝나면 진짜 State(messages)로 돌아간다.
  const [optimisticMessages, addOptimistic] = useOptimistic(messages, (current: Message[], text: string) => [
    ...current, { id: -1, text, pending: true },
  ]);

  // useActionState: 폼 제출 함수의 결과(여기서는 오류 문구)를 State로 관리한다.
  const [errorMessage, formAction] = useActionState(async (_previous: string, formData: FormData) => {
    // formData.get은 문자열 또는 파일(File)을 돌려줄 수 있어, 문자열일 때만 쓴다.
    const rawText = formData.get("text");
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!text) return "내용을 입력하세요.";
    addOptimistic(text);
    try {
      const saved = await saveMessage(text);
      setMessages((previous) => [...previous, saved]);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "알 수 없는 오류";
    }
  }, "");

  return (
    <main>
      <h1>방명록 (React 19 Actions)</h1>
      <form action={formAction} className="row">
        <input name="text" placeholder="한 줄 남기기" />
        <SubmitButton />
      </form>
      {errorMessage ? <p className="error" role="alert">{errorMessage}</p> : null}
      <ul className="list">
        {optimisticMessages.map((message) => (
          <li key={message.id} style={{ opacity: message.pending ? 0.5 : 1 }}>{message.text}{message.pending ? " (저장 중)" : ""}</li>
        ))}
      </ul>
    </main>
  );
}
