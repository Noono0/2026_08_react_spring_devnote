/**
 * ============================================================================
 * RefsFocusPracticePage.tsx — 【고급】 ref로 포커스·스크롤 다루기 (키보드 사용자 배려)
 * ============================================================================
 *
 * [ref가 필요한 순간]
 *   React는 화면을 State로 "선언"하지만, 포커스 옮기기·스크롤처럼 "지금 이 요소에 무엇을 하라"는 명령은
 *   실제 DOM 요소를 직접 잡아야 한다. 그 손잡이가 ref다.
 *     const inputRef = useRef<HTMLInputElement>(null);
 *     <input ref={inputRef} />  →  inputRef.current.focus()
 *
 * [이 화면에서 배우는 네 가지]
 *   1. 입력 오류가 나면 그 칸으로 포커스를 옮긴다. (화면 낭독기 사용자도 무엇이 틀렸는지 바로 안다)
 *   2. 항목을 지우면 포커스를 "다음 항목"으로 옮긴다. 지운 버튼이 사라지면 포커스가 페이지 맨 위로 튀기 때문이다.
 *   3. React 19부터 ref를 일반 prop처럼 넘길 수 있다. (예전에는 forwardRef로 감싸야 했다)
 *   4. 콜백 ref로 여러 항목의 요소를 Map에 모은다. React 19는 콜백 ref가 정리 함수를 돌려줄 수 있다.
 *
 * ★ ref.current를 바꿔도 화면은 다시 그려지지 않는다. 화면에 보여야 하는 값은 State, 손잡이는 ref.
 */

import { useRef, useState, type FormEvent, type InputHTMLAttributes, type Ref } from "react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { createUuid } from "@/shared/lib/createUuid";

interface AgendaItem {
  agendaId: string;
  title: string;
}

// InputHTMLAttributes를 이어받으면 value·onChange·placeholder 같은 <input>의 모든 속성을 그대로 받을 수 있다.
interface AgendaTextFieldProperties extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorMessage?: string;
  // ★ React 19: ref도 그냥 props 중 하나로 받는다. forwardRef가 필요 없다.
  ref?: Ref<HTMLInputElement>;
}

/** 라벨·입력칸·오류 문구를 묶은 입력 컴포넌트. 바깥에서 넘긴 ref가 안쪽 <input>에 연결된다. */
const AgendaTextField = ({ label, errorMessage, ref, id, ...inputProps }: AgendaTextFieldProperties) => {
  // 오류 문구에 붙일 id. 입력칸의 aria-describedby가 이 id를 가리켜 둘을 연결한다.
  const errorId = `${id ?? "agenda"}-error`;
  return (
    <label htmlFor={id}>
      {label}
      <input
        // 나머지 속성(value, onChange 등)을 그대로 펼쳐 넘긴다(rest/spread).
        {...inputProps}
        id={id}
        ref={ref}
        aria-invalid={errorMessage ? true : undefined}
        // 오류 문구를 입력칸 설명으로 연결해, 포커스가 오면 화면 낭독기가 오류도 함께 읽는다.
        aria-describedby={errorMessage ? errorId : undefined}
      />
      {errorMessage ? <span id={errorId} className="field-error">{errorMessage}</span> : null}
    </label>
  );
};

export const RefsFocusPracticePage = () => {
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([
    { agendaId: "agenda-1", title: "지난 회의 결정 사항 확인" },
    { agendaId: "agenda-2", title: "배포 일정 정하기" },
  ]);
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // 입력칸 손잡이. 처음엔 null이고, 화면에 붙으면 React가 실제 <input> 요소를 넣어 준다.
  const titleInputRef = useRef<HTMLInputElement>(null);
  // 항목 id → 그 항목의 삭제 버튼. 여러 요소를 잡아야 해서 ref 하나 대신 Map을 쓴다.
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  // 새로 추가한 항목으로 스크롤할지 표시만 해 두는 값. 화면에 보일 필요가 없으므로 State가 아니라 ref다.
  const scrollTargetIdRef = useRef<string | null>(null);

  const addAgenda = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim()) {
      setErrorMessage("안건 제목을 입력해 주세요.");
      // 오류가 난 칸으로 포커스를 옮긴다. ?.는 아직 요소가 없을(null) 때 오류 없이 넘어가게 한다.
      titleInputRef.current?.focus();
      return;
    }
    const agendaId = createUuid();
    scrollTargetIdRef.current = agendaId;
    setAgendaItems((currentItems) => [...currentItems, { agendaId, title: title.trim() }]);
    setTitle("");
    setErrorMessage("");
    // 연달아 입력할 수 있도록 포커스를 입력칸에 그대로 둔다.
    titleInputRef.current?.focus();
  };

  const deleteAgenda = (agendaId: string): void => {
    // 지우기 전에 몇 번째였는지 기억해 둔다(지운 뒤에는 그 자리의 "다음 항목"을 찾는 데 쓴다).
    const deletedIndex = agendaItems.findIndex((item) => item.agendaId === agendaId);
    const remainingItems = agendaItems.filter((item) => item.agendaId !== agendaId);
    setAgendaItems(remainingItems);
    // 지운 자리의 다음 항목(없으면 이전 항목, 그것도 없으면 입력칸)으로 포커스를 옮길 대상을 정한다.
    const nextFocusItem = remainingItems[deletedIndex] ?? remainingItems[deletedIndex - 1];
    // 화면이 다시 그려진 뒤에 포커스를 옮겨야 하므로 다음 프레임으로 미룬다.
    window.requestAnimationFrame(() => {
      const nextButton = nextFocusItem ? deleteButtonRefs.current.get(nextFocusItem.agendaId) : undefined;
      // ??: 왼쪽이 null·undefined면 오른쪽을 쓴다. 남은 항목이 없으면 입력칸으로 포커스를 보낸다.
      (nextButton ?? titleInputRef.current)?.focus();
    });
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="refs-focus">ref로 포커스·스크롤 다루기</LearningGuideTitle>
          <p>입력 오류·삭제·추가 뒤에 포커스와 스크롤을 옮겨 키보드와 화면 낭독기 사용자도 흐름을 잃지 않게 합니다.</p>
        </div>
      </div>

      <div className="split-practice-layout">
        <form className="practice-card" onSubmit={addAgenda} noValidate>
          <h2>안건 추가</h2>
          <AgendaTextField
            id="agenda-title"
            label="안건 제목"
            // React 19: 일반 prop처럼 ref를 넘기면 AgendaTextField 안쪽 <input>에 연결된다.
            ref={titleInputRef}
            value={title}
            errorMessage={errorMessage}
            onChange={(event) => { setTitle(event.target.value); if (errorMessage) setErrorMessage(""); }}
          />
          <button type="submit">추가</button>
          <small>Tab 키만으로 추가·삭제해 보세요. 포커스가 어디로 가는지 확인합니다.</small>
        </form>

        <article className="practice-card">
          <h2>회의 안건 ({agendaItems.length})</h2>
          {agendaItems.length === 0 ? <p>안건이 없습니다.</p> : (
            <ol className="practice-check-list" aria-label="안건 목록">
              {agendaItems.map((item) => (
                <li
                  key={item.agendaId}
                  // ★ 콜백 ref: 요소가 화면에 붙을 때 호출된다. 방금 추가한 항목이면 보이도록 스크롤한다.
                  ref={(element) => {
                    if (element && scrollTargetIdRef.current === item.agendaId) {
                      element.scrollIntoView({ block: "nearest" });
                      scrollTargetIdRef.current = null;
                    }
                  }}
                >
                  <span>{item.title}</span>
                  <button
                    type="button"
                    className="ghost-button"
                    aria-label={`${item.title} 삭제`}
                    // ★ React 19: 콜백 ref가 정리 함수를 돌려주면, 요소가 사라질 때 React가 불러 준다.
                    ref={(button) => {
                      if (!button) return;
                      deleteButtonRefs.current.set(item.agendaId, button);
                      return () => { deleteButtonRefs.current.delete(item.agendaId); };
                    }}
                    onClick={() => deleteAgenda(item.agendaId)}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
};
