/**
 * ============================================================================
 * ReactActionsGuestbookPage.tsx — 【고급】 React 19 Actions로 만드는 방명록
 * ============================================================================
 *
 * React 19에서 폼 제출을 다루는 새 도구 세 가지를 한 화면에서 쓴다.
 *
 *   useActionState → 제출 함수(action)의 "결과 상태"와 "처리 중 여부"를 함께 관리한다.
 *                    예전에는 isSubmitting·errorMessage·결과값을 useState로 각각 만들었다.
 *   useFormStatus  → 폼 안쪽 컴포넌트(제출 버튼)가 "지금 이 폼이 제출 중인지"를 props 없이 알아낸다.
 *   useOptimistic  → 서버 응답을 기다리지 않고 화면에 먼저 보여 주고,
 *                    작업이 끝나면 실제 값으로 자동 교체한다. 실패하면 저절로 원래대로 돌아간다.
 *
 * [TanStack Query의 낙관적 업데이트(10단계)와 비교]
 *   10단계: onMutate에서 캐시를 직접 바꾸고, onError에서 직접 되돌렸다(롤백 코드 필요).
 *   여기  : useOptimistic 값은 액션이 끝나면 버려지고 진짜 State(messages)가 다시 보인다.
 *          그래서 실패했을 때 되돌리는 코드를 따로 쓰지 않는다.
 *   서버 데이터를 여러 화면이 공유하면 TanStack Query가, 한 폼 안의 짧은 흐름은 Actions가 더 간단하다.
 *
 * [폼 자동 초기화]
 *   <form action={...}>으로 제출하면 React가 작업이 끝난 뒤 입력칸을 defaultValue로 되돌린다.
 *   실패했을 때 입력한 내용이 사라지지 않도록, 결과 상태에 입력값을 담아 defaultValue로 다시 넣는다.
 *
 * [연습해 보기]
 *   내용에 "error"를 넣고 등록하면 회색 "저장 중" 글이 잠깐 보였다가 사라지고 오류가 표시된다.
 */

import { useActionState, useOptimistic, useState } from "react";
import { useFormStatus } from "react-dom";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import {
  addGuestbookMessage,
  initialGuestbookMessages,
  type GuestbookMessage,
} from "@/features/practice/18-react19-actions/api/localGuestbookApi";

interface GuestbookFormState {
  status: "idle" | "success" | "error";
  message: string;
  /** 실패했을 때 입력값을 되살리기 위한 값 */
  values: { authorName: string; content: string };
}

/** 화면에 그릴 글. 저장 중인 글은 아직 서버 번호가 없으므로 pending으로 구분한다. */
type DisplayedMessage = GuestbookMessage & { pending?: boolean };

const initialFormState: GuestbookFormState = { status: "idle", message: "", values: { authorName: "", content: "" } };
const MAX_CONTENT_LENGTH = 200;

/** useFormStatus는 "폼 안쪽"에 있는 컴포넌트에서만 동작한다. 그래서 버튼을 따로 뺐다. */
const GuestbookSubmitButton = () => {
  // 가장 가까운 상위 <form>이 제출 중이면 pending = true. 두 번 누르지 못하게 버튼을 막는다.
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "등록 중..." : "방명록 등록"}</button>;
};

export const ReactActionsGuestbookPage = () => {
  // 서버가 저장을 확인한 "진짜" 목록
  const [messages, setMessages] = useState<GuestbookMessage[]>(initialGuestbookMessages);

  // 두 번째 인자는 "임시로 화면을 어떻게 바꿀지" 정하는 함수다. 새 글을 맨 앞에 붙인다.
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<DisplayedMessage[], DisplayedMessage>(
    messages,
    (currentMessages, pendingMessage) => [pendingMessage, ...currentMessages],
  );

  // action(이전 상태, 폼 데이터) → 다음 상태. React가 transition 안에서 실행하고 isPending을 관리한다.
  const [formState, formAction, isPending] = useActionState<GuestbookFormState, FormData>(
    async (_previousState, formData) => {
      // FormData 값은 string 또는 File이다. 문자열이 아니면 빈 문자열로 본다.
      const rawAuthor = formData.get("authorName");
      const rawContent = formData.get("content");
      const values = {
        authorName: typeof rawAuthor === "string" ? rawAuthor.trim() : "",
        content: typeof rawContent === "string" ? rawContent.trim() : "",
      };
      // 검증 실패도 예외가 아니라 "다음 상태"로 돌려준다. 화면은 formState.status·message를 보고 오류를 그린다.
      if (!values.authorName || !values.content) {
        return { status: "error", message: "이름과 내용을 모두 입력해 주세요.", values };
      }
      if (values.content.length > MAX_CONTENT_LENGTH) {
        return { status: "error", message: `내용은 ${MAX_CONTENT_LENGTH}자 이하여야 합니다.`, values };
      }

      // ★ 응답 전에 먼저 보여 준다. 임시 번호는 음수로 만들어 진짜 번호와 겹치지 않게 한다.
      addOptimisticMessage({ ...values, messageId: -Date.now(), createdAt: new Date().toISOString(), pending: true });
      try {
        const savedMessage = await addGuestbookMessage(values.authorName, values.content);
        // 진짜 목록을 갱신한다. 액션이 끝나면 임시 글 대신 이 목록이 보인다.
        setMessages((currentMessages) => [savedMessage, ...currentMessages]);
        return { status: "success", message: "방명록을 등록했습니다.", values: initialFormState.values };
      } catch (error) {
        // 진짜 목록을 바꾸지 않았으므로 임시 글은 자동으로 사라진다. (롤백 코드가 필요 없다)
        return { status: "error", message: error instanceof Error ? error.message : "알 수 없는 오류입니다.", values };
      }
    },
    initialFormState,
  );

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="react19-actions">React 19 Actions 방명록</LearningGuideTitle>
          <p>useActionState·useFormStatus·useOptimistic으로 제출 상태, 오류, 낙관적 표시를 함께 처리합니다.</p>
        </div>
      </div>

      <div className="split-practice-layout">
        {/* onSubmit 대신 action에 함수를 넘긴다. preventDefault도 React가 알아서 한다. */}
        <form className="practice-card" action={formAction}>
          <h2>방명록 쓰기</h2>
          {/* 비제어 입력칸(defaultValue + name): 값은 제출할 때 FormData로 한 번에 읽는다. 실패하면 이전 입력값이 defaultValue로 돌아온다. */}
          <label>이름<input name="authorName" defaultValue={formState.values.authorName} maxLength={20} /></label>
          <label>내용<textarea name="content" rows={4} defaultValue={formState.values.content} placeholder="error 입력 시 실패 재현" /></label>
          {formState.status !== "idle" ? (
            <p className={formState.status === "error" ? "field-error" : undefined} role={formState.status === "error" ? "alert" : "status"}>
              {formState.message}
            </p>
          ) : null}
          <GuestbookSubmitButton />
        </form>

        {/* aria-busy: 목록이 갱신 중임을 화면 낭독기에 알린다. 제목의 개수는 진짜 목록(messages) 기준이다. */}
        <article className="practice-card" aria-busy={isPending}>
          <h2>방명록 ({messages.length})</h2>
          <ul className="practice-guestbook-list" aria-label="방명록 목록">
            {/* 진짜 목록 대신 낙관적 목록을 그린다. 저장 중인 글은 pending 클래스로 흐리게 보인다. */}
            {optimisticMessages.map((message) => (
              <li key={message.messageId} className={message.pending ? "practice-guestbook-pending" : undefined}>
                <strong>{message.authorName}</strong> {message.content}
                <small>{message.pending ? " · 저장 중" : ` · ${new Date(message.createdAt).toLocaleString("ko-KR")}`}</small>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};
