/**
 * ============================================================================
 * TodoPracticePage.tsx — 【초급】 배열 State로 하는 CRUD 연습
 * ============================================================================
 *
 * ★ React를 처음 배운다면 이 파일부터 읽자. 가장 기본이 되는 화면이다.
 *
 * [CRUD가 뭔가요?]
 *   프로그램이 데이터를 다루는 네 가지 기본 동작의 앞글자다.
 *     Create(생성) - Read(조회) - Update(수정) - Delete(삭제)
 *   세상의 거의 모든 앱이 결국 이 네 가지의 조합이다.
 *
 * [이 페이지의 핵심 규칙 — 서버가 없다]
 *   데이터가 브라우저 메모리(React State)에만 있다.
 *   그래서 새로고침하면 처음 상태로 돌아간다. 버그가 아니라 의도된 것이다.
 *   서버 연동은 나중 단계에서 배운다. 지금은 "State를 다루는 법"에만 집중한다.
 *
 * [배울 개념 3가지]
 *   1. useState  : 값이 바뀌면 화면이 자동으로 다시 그려지는 "특별한 변수"
 *   2. 불변성    : 배열을 직접 고치지 말고 새 배열을 만들어야 하는 이유
 *   3. useMemo   : 계산 결과를 재사용해서 낭비를 줄이는 법
 *
 * ★★ 이 페이지에서 절대 잊으면 안 되는 한 가지
 *   push, splice, sort 같은 함수는 원본 배열을 직접 바꾼다 → 쓰면 안 된다.
 *   map, filter, [...배열] 은 새 배열을 만들어 준다 → 이걸 쓴다.
 *   왜 그런지는 아래 각 함수에서 자세히 설명한다.
 */

import { useMemo, useState } from "react";
import { applicationLogger } from "@/shared/logging/applicationLogger";
import { applicationNotification } from "@/shared/notification/applicationNotification";

/**
 * 할 일 하나의 모양(타입)을 먼저 정한다.
 *
 * ★ 왜 타입을 먼저 정하나?
 *   이렇게 해 두면 todoItem.titel 처럼 오타를 냈을 때
 *   실행하기도 전에 에디터가 빨간 줄로 알려 준다.
 *   또 `.` 만 찍으면 쓸 수 있는 속성이 자동완성으로 뜬다.
 */
interface TodoItem {
  todoId: number;      // 각 할 일을 구분하는 고유 번호
  todoTitle: string;   // 할 일 내용
  completed: boolean;  // 완료했는지 여부
}

// 필터 값으로 쓸 수 있는 세 가지를 못 박는다.
// string으로 두면 "ACITVE" 같은 오타를 아무도 못 잡아 준다.
type TodoFilter = "ALL" | "ACTIVE" | "COMPLETED";

// 화면을 처음 열었을 때 보여줄 샘플 데이터.
// 컴포넌트 바깥에 둔 이유: 고정된 값이라 매번 새로 만들 필요가 없다.
const initialTodoItems: TodoItem[] = [
  { todoId: 1, todoTitle: "컴포넌트 역할 확인하기", completed: true },
  { todoId: 2, todoTitle: "배열 불변성 연습하기", completed: false },
];

export const TodoPracticePage = () => {
  // ── useState 다섯 개 ────────────────────────────────────────────
  //
  // [useState 문법 뜯어보기]
  //   const [값, 값을바꾸는함수] = useState(처음값);
  //
  //   왜 대괄호로 받나? useState가 배열 두 칸을 돌려주기 때문이다.
  //   0번째는 현재 값, 1번째는 바꾸는 함수. 이름은 마음대로 지어도 된다.
  //   (다만 setXxx 형태로 짓는 게 모두의 관례다)
  //
  // [일반 변수와 뭐가 다른가? — 이게 핵심이다]
  //   let count = 0; count = 1;  → 값은 바뀌지만 화면은 그대로다.
  //   setCount(1);               → 값도 바뀌고 화면도 다시 그려진다.
  //   "화면에 보여야 하는 값"은 반드시 State여야 한다.

  // 할 일 목록 전체.
  const [todoItems, setTodoItems] = useState<TodoItem[]>(initialTodoItems);

  // 입력창에 지금 타이핑 중인 글자.
  //
  // ★ 입력창의 글자도 State여야 하나? → 그렇다.
  //   React에서는 input의 value를 State에 묶어 두는 방식을 쓴다.
  //   이걸 "제어 컴포넌트(controlled component)"라고 한다.
  //   그래야 버튼을 눌렀을 때 입력값을 알 수 있고, 코드로 비울 수도 있다.
  const [newTodoTitle, setNewTodoTitle] = useState("");

  // 지금 수정 중인 항목의 id. 아무것도 수정 중이 아니면 null.
  //
  // `<number | null>` = "숫자이거나 null"이라는 뜻.
  // 이렇게 적어 두면 "수정 중이 아님"을 명확하게 표현할 수 있다.
  // 0을 쓰면 "0번 항목"과 헷갈리니 null이 훨씬 안전하다.
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);

  // 수정 중인 항목의 입력 내용.
  //
  // ★ 왜 원본과 따로 관리하나?
  //   수정 중에 원본을 바로 바꿔 버리면 "취소" 기능을 만들 수 없다.
  //   따로 두면 저장 버튼을 눌렀을 때만 원본에 반영할 수 있다.
  const [editingTodoTitle, setEditingTodoTitle] = useState("");

  // 현재 선택된 필터.
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("ALL");

  // ── useMemo: 계산 결과 재활용하기 ───────────────────────────────
  //
  // [먼저 알아야 할 사실]
  //   React 컴포넌트 함수는 State가 바뀔 때마다 위에서 아래까지 통째로 다시 실행된다.
  //   즉 입력창에 글자 하나만 쳐도 이 함수 전체가 다시 돌아간다.
  //
  // [그래서 useMemo가 필요하다]
  //   useMemo(계산함수, [의존성])
  //     → 의존성 배열의 값이 바뀌었을 때만 계산을 다시 한다.
  //     → 안 바뀌었으면 지난번 결과를 그대로 재사용한다.
  //
  //   여기서는 [todoFilter, todoItems] 를 지켜본다.
  //   그래서 입력창에 타이핑을 아무리 해도 이 필터링은 다시 계산되지 않는다.
  //
  // ★ 솔직히 말하면, 항목이 두세 개인 지금은 useMemo가 없어도 전혀 안 느리다.
  //   여기서는 "이런 도구가 있고 이렇게 쓴다"를 배우는 게 목적이다.
  //   무조건 useMemo를 붙이는 건 오히려 코드만 복잡해지니 주의하자.
  const filteredTodoItems = useMemo(
    // filter: 조건에 맞는 것만 골라 "새 배열"을 만든다. 원본은 그대로 남는다.
    // 그래서 필터를 바꿨다가 "전체"로 돌아오면 항목이 다시 다 보인다.
    () => todoItems.filter((todoItem) => {
      if (todoFilter === "ACTIVE") return !todoItem.completed;   // 미완료만
      if (todoFilter === "COMPLETED") return todoItem.completed; // 완료만
      return true;                                                // ALL: 전부 통과
    }),
    // 의존성 배열. 이 안의 값이 바뀌어야만 위 함수를 다시 실행한다.
    // 여기에 필요한 값을 빠뜨리면 "필터를 바꿨는데 목록이 그대로"인 버그가 생긴다.
    [todoFilter, todoItems],
  );

  /** 【Create】 새 할 일을 목록에 추가한다. */
  const createTodo = (): void => {
    // trim(): 앞뒤 공백을 없앤다. 스페이스만 잔뜩 친 것도 빈 값으로 취급하기 위해서다.
    const trimmedTodoTitle = newTodoTitle.trim();
    if (!trimmedTodoTitle) {
      applicationNotification.warning("할 일을 입력해 주세요.");
      // early return: 잘못된 경우 여기서 함수를 끝낸다.
      // 아래 코드를 else로 감싸는 것보다 들여쓰기가 얕아져 읽기 쉽다.
      return;
    }

    const createdTodoItem: TodoItem = {
      // Date.now(): 1970년부터 지금까지의 밀리초. 매번 다른 숫자라 id로 쓸 만하다.
      //
      // ★ 실무에서는 이렇게 안 한다.
      //   같은 밀리초에 두 개를 만들면 id가 겹칠 수 있다.
      //   진짜 앱에서는 서버가 id를 만들어 주거나 crypto.randomUUID()를 쓴다.
      //   여기서는 연습이니 가장 단순한 방법을 썼다.
      todoId: Date.now(),
      todoTitle: trimmedTodoTitle,
      completed: false, // 새로 만든 할 일은 당연히 미완료 상태로 시작
    };

    applicationLogger.info("[TodoPracticePage] 할 일 생성", { createdTodoItem });

    // ★★★ 이 한 줄이 이 페이지에서 가장 중요하다.
    //
    // `[...previousTodoItems, createdTodoItem]`
    //   `...`(전개 연산자)로 기존 항목을 모두 펼쳐 담고, 뒤에 새 항목을 붙여
    //   완전히 새로운 배열을 만든다.
    //
    // ✗ 이렇게 하면 안 된다:
    //     todoItems.push(createdTodoItem);
    //     setTodoItems(todoItems);
    //   → push는 원본 배열을 직접 바꾼다. 배열의 "주소"는 그대로다.
    //     React는 이전 값과 새 값의 주소만 비교하므로 "안 바뀌었네"라고 판단하고
    //     화면을 다시 그리지 않는다. 데이터는 늘었는데 화면은 그대로인 유령 버그다.
    //
    // ✓ 새 배열을 만들면 주소가 달라져서 React가 변화를 확실히 알아챈다.
    //
    // 그리고 `(previous) => ...` 함수형 업데이트를 쓴 이유는
    // React가 넘겨주는 "확실한 최신 값"을 기준으로 계산하기 위해서다.
    // 바깥의 todoItems 변수는 상황에 따라 옛날 값일 수 있다.
    setTodoItems((previousTodoItems) => [...previousTodoItems, createdTodoItem]);

    // 입력창 비우기. State를 ""로 바꾸면 화면의 input도 따라서 비워진다.
    // (input의 value가 이 State에 묶여 있기 때문이다)
    setNewTodoTitle("");
    applicationNotification.success("할 일을 추가했습니다.");
  };

  /** 【Update】 특정 할 일의 제목을 바꾼다. */
  const updateTodo = (todoId: number): void => {
    const trimmedTodoTitle = editingTodoTitle.trim();
    if (!trimmedTodoTitle) return;

    // ★ map으로 "일부만 바꾼 새 배열"을 만드는 것이 수정의 정석 패턴이다.
    //
    //   map은 배열의 모든 원소를 하나씩 보면서 새 배열을 만든다.
    //   - id가 일치하는 것 → 내용을 바꾼 새 객체로 교체
    //   - 나머지          → 원래 객체를 그대로 사용
    //
    //   `{ ...todoItem, todoTitle: 새제목 }` 의 의미:
    //     기존 객체의 모든 속성을 복사한 뒤(...todoItem),
    //     todoTitle만 새 값으로 덮어쓴 새 객체를 만든다.
    //     completed 같은 다른 속성은 자동으로 유지된다.
    //
    //   ✗ todoItem.todoTitle = 새제목  ← 원본 객체를 직접 고치는 것. 금지!
    setTodoItems((previousTodoItems) => previousTodoItems.map((todoItem) => (
      todoItem.todoId === todoId ? { ...todoItem, todoTitle: trimmedTodoTitle } : todoItem
    )));

    // 수정 모드 종료. 두 State를 초기화하면 화면이 다시 "보기 모드"로 돌아간다.
    setEditingTodoId(null);
    setEditingTodoTitle("");
    applicationNotification.success("할 일을 수정했습니다.");
  };

  /** 【Delete】 특정 할 일을 목록에서 지운다. */
  const deleteTodo = (todoId: number): void => {
    applicationLogger.info("[TodoPracticePage] 할 일 삭제", { todoId });

    // filter는 "조건에 맞는 것만 남긴 새 배열"을 만든다.
    // 여기서는 "id가 다른 것만 남긴다" = "id가 같은 것은 빠진다" 는 뜻이다.
    //
    // ✗ splice(index, 1) 은 원본을 직접 바꾸므로 쓰면 안 된다.
    //   게다가 index를 먼저 찾아야 해서 코드도 더 길어진다.
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

      {/* ── 【Create】 새 할 일 입력 영역 ───────────────────────────── */}
      <div className="inline-create-form">
        {/* ★ 제어 컴포넌트(controlled component)의 기본형.
            두 가지가 한 쌍으로 움직인다.
              value    : State의 값을 input에 보여준다 (State → 화면)
              onChange : 사용자가 친 글자를 State에 저장한다 (화면 → State)

            둘 중 하나만 있으면 문제가 생긴다.
              value만 있으면 → 글자를 쳐도 화면이 안 바뀐다 (State가 안 변하니까)
              onChange만 있으면 → 코드로 입력창을 비울 수 없다

            이 왕복 구조를 "단방향 데이터 흐름"이라고 부른다.
            화면의 진실은 항상 State에 있고, input은 그걸 비출 뿐이다. */}
        <input
          value={newTodoTitle}
          // changeEvent.target = 이벤트가 일어난 요소(이 input)
          // .value = 그 안에 지금 들어 있는 글자
          onChange={(changeEvent) => setNewTodoTitle(changeEvent.target.value)}
          // 엔터 키로도 추가할 수 있게 한다. 매번 마우스로 버튼을 누르는 건 번거롭다.
          // 이런 작은 배려가 사용성을 크게 바꾼다.
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Enter") createTodo();
          }}
          placeholder="새 할 일을 입력하세요"
        />
        <button type="button" onClick={createTodo}>추가</button>
      </div>

      {/* ── 필터 버튼 세 개 ─────────────────────────────────────────── */}
      <div className="segmented-control" aria-label="할 일 필터">
        {/* 버튼 세 개를 복붙하지 않고 배열을 .map()으로 돌려 만든다.
            `as TodoFilter[]`는 "이 문자열 배열을 TodoFilter 배열로 봐 달라"는 타입 단언이다.
            안 적으면 TypeScript가 그냥 string[]으로 보고 타입이 느슨해진다. */}
        {(["ALL", "ACTIVE", "COMPLETED"] as TodoFilter[]).map((filterValue) => (
          <button
            type="button"
            key={filterValue}
            // 현재 선택된 필터에만 active 클래스를 붙여 시각적으로 구분한다.
            className={todoFilter === filterValue ? "active" : ""}
            // ★ 화살표 함수로 감싼 이유: 인자(filterValue)를 넘겨야 하기 때문이다.
            //   onClick={setTodoFilter(filterValue)} 라고 쓰면
            //   클릭할 때가 아니라 화면을 그릴 때 바로 실행돼서 무한 루프에 빠진다.
            onClick={() => setTodoFilter(filterValue)}
          >
            {/* 영어 코드값을 한국어로 바꾸는 짧은 요령.
                객체를 만들고 바로 [키]로 꺼내는 방식이다.
                  { ALL: "전체", ... }["ALL"]  →  "전체"
                if를 세 번 쓰는 것보다 짧다. 다만 처음 보면 낯설 수 있다. */}
            {{ ALL: "전체", ACTIVE: "진행 중", COMPLETED: "완료" }[filterValue]}
          </button>
        ))}
      </div>

      {/* ── 【Read】 목록 보여주기 ──────────────────────────────────── */}
      <div className="crud-list">
        {/* ★ 원본 todoItems가 아니라 filteredTodoItems를 그린다.
            "원본은 그대로 두고, 화면에 보여줄 것만 걸러서" 쓰는 방식이다.
            원본을 직접 지워 버리면 필터를 "전체"로 되돌려도 항목이 돌아오지 않는다. */}
        {filteredTodoItems.map((todoItem) => (
          // ★ key는 React가 각 항목을 알아보는 이름표다. 목록을 만들 때는 필수다.
          //   key가 없거나 겹치면 항목을 지웠을 때 엉뚱한 게 사라지거나
          //   입력 중이던 내용이 다른 줄로 옮겨 가는 기괴한 버그가 생긴다.
          //   반드시 그 항목만의 고유한 값(여기서는 todoId)을 쓰자. 인덱스는 피한다.
          <article className="crud-list-item" key={todoItem.todoId}>
            {/* 완료 체크박스.
                체크박스는 value가 아니라 `checked`로 상태를 표현한다.
                여기서도 State가 진실이고 체크박스는 그걸 비출 뿐이다. */}
            <input
              className="checkbox-input"
              type="checkbox"
              checked={todoItem.completed}
              // 완료 여부를 뒤집는 처리. 위 updateTodo와 똑같은 map 패턴이다.
              // `!currentTodoItem.completed` 로 true↔false를 뒤집는다.
              //
              // 변수 이름이 currentTodoItem과 todoItem 두 개인 것에 주의:
              //   todoItem        → 지금 이 줄이 그리고 있는 항목 (바깥 map에서 온 것)
              //   currentTodoItem → 안쪽 map이 훑고 있는 각 항목
              // 이름이 같으면 헷갈리니 일부러 다르게 지었다.
              onChange={() => setTodoItems((previousTodoItems) => previousTodoItems.map((currentTodoItem) => (
                currentTodoItem.todoId === todoItem.todoId
                  ? { ...currentTodoItem, completed: !currentTodoItem.completed }
                  : currentTodoItem
              )))}
              // 체크박스 자체에는 글자가 없어서 화면 낭독기가 읽을 게 없다.
              // 무엇에 대한 체크박스인지 알려 준다.
              aria-label={`${todoItem.todoTitle} 완료 여부`}
            />

            {/* ★ 조건부 렌더링 — 같은 자리에 두 가지 모습을 번갈아 보여주기.
                지금 수정 중인 줄이면 입력창을, 아니면 그냥 글자를 그린다.
                한 화면 안에서 "보기 모드 ↔ 수정 모드"를 전환하는 흔한 패턴이다. */}
            {editingTodoId === todoItem.todoId ? (
              <input
                value={editingTodoTitle}
                onChange={(changeEvent) => setEditingTodoTitle(changeEvent.target.value)}
                // autoFocus: 나타나자마자 커서를 이 입력창에 놓는다.
                // 수정 버튼을 누른 뒤 다시 입력창을 클릭해야 한다면 번거롭다.
                autoFocus
              />
            ) : (
              // 완료된 항목에는 취소선 클래스를 붙인다.
              <span className={todoItem.completed ? "completed-text" : ""}>{todoItem.todoTitle}</span>
            )}

            <div className="button-row compact-button-row">
              {/* 버튼도 모드에 따라 "저장" ↔ "수정"으로 바뀐다. */}
              {editingTodoId === todoItem.todoId ? (
                <button type="button" onClick={() => updateTodo(todoItem.todoId)}>저장</button>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  // 수정 모드로 들어갈 때 State 두 개를 함께 바꾼다.
                  //   1) 어느 줄을 수정 중인지 표시
                  //   2) 입력창에 현재 제목을 미리 채워 넣기
                  //
                  // ★ 2번을 빼먹으면 수정 버튼을 눌렀을 때 입력창이 텅 비어서
                  //   사용자가 제목을 처음부터 다시 쳐야 한다. 자주 하는 실수다.
                  //
                  // 이렇게 여러 줄을 실행해야 할 때는 화살표 함수 뒤에 중괄호를 쓴다.
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
