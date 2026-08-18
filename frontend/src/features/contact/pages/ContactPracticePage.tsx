/**
 * ============================================================================
 * ContactPracticePage.tsx — 【초급+】 useReducer와 localStorage 연습
 * ============================================================================
 *
 * TodoPracticePage를 먼저 읽고 오자. 이 페이지는 그 다음 단계다.
 *
 * [1) useState 대신 useReducer를 쓰는 이유]
 *   Todo 페이지에서는 setTodoItems(...) 안에 map/filter 로직이 들어 있었다.
 *   기능이 서너 개일 땐 괜찮지만, 열 개쯤 되면 이런 문제가 생긴다.
 *     - 상태 변경 코드가 컴포넌트 여기저기 흩어진다
 *     - 비슷한 map/filter 코드가 반복된다
 *     - "이 상태가 어디서 왜 바뀌었지?"를 추적하기 어렵다
 *
 *   useReducer는 "상태를 바꾸는 모든 규칙"을 reducer 함수 하나에 모은다.
 *   컴포넌트는 "무엇을 하고 싶은지(action)"만 알리고, 어떻게 바꿀지는 신경 안 쓴다.
 *
 *     [useState 방식]   컴포넌트: "이 배열을 이렇게 계산해서 넣어줘" (방법을 지시)
 *     [useReducer 방식] 컴포넌트: "삭제해줘, 3번을"                  (의도만 전달)
 *
 *   → 상태 로직을 화면 코드에서 분리하는 것이 핵심이다.
 *
 * [2) localStorage로 새로고침해도 살아남기]
 *   Todo 페이지는 새로고침하면 데이터가 날아갔다.
 *   여기서는 바뀔 때마다 브라우저 저장소에 적어 두고, 켤 때 다시 읽어 온다.
 *
 * [배울 개념]
 *   useReducer / Action / 판별 유니온 타입 / useEffect로 동기화 / 안전한 JSON 파싱
 */

import { useEffect, useMemo, useReducer, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";

/** 연락처 하나의 모양. */
interface ContactItem {
  contactId: number;
  contactName: string;
  emailAddress: string;
  phoneNumber: string;
}

/**
 * Action = "무슨 일을 해 달라"는 요청서.
 *
 * ★ 이 타입 정의가 useReducer의 핵심이자 가장 멋진 부분이다.
 *   이런 형태를 "판별 유니온(discriminated union)"이라고 부른다.
 *   `type` 이라는 공통 칸의 값으로 어느 종류인지 구별한다는 뜻이다.
 *
 *   TypeScript는 이 타입을 보고 이렇게 판단해 준다:
 *     type이 "CREATE"면 → contactItem이 반드시 있다 (contactId는 없다)
 *     type이 "DELETE"면 → contactId가 반드시 있다 (contactItem은 없다)
 *
 *   그래서 reducer 안에서 case "DELETE" 를 쓰면
 *   action.contactId 는 자동완성되고, action.contactItem 은 에러가 난다.
 *   실수로 잘못된 데이터를 넘기는 걸 컴파일 단계에서 막아 주는 것이다.
 *
 *   `|` 는 "또는"이라는 뜻이고, 맨 앞의 `|`는 줄 맞춤용이라 있어도 없어도 된다.
 */
type ContactAction =
  | { type: "CREATE"; contactItem: ContactItem }   // 새 연락처를 추가해 달라
  | { type: "UPDATE"; contactItem: ContactItem }   // 이 내용으로 바꿔 달라
  | { type: "DELETE"; contactId: number }          // 이 번호를 지워 달라
  | { type: "RESET"; contactItems: ContactItem[] };// 목록을 통째로 갈아 달라

// localStorage 키. 문자열을 여러 곳에서 쓰므로 상수로 뺐다. (오타 방지)
const CONTACT_STORAGE_KEY = "practiceContacts";

const initialContacts: ContactItem[] = [
  { contactId: 1, contactName: "김리액트", emailAddress: "react@example.com", phoneNumber: "010-1111-2222" },
  { contactId: 2, contactName: "박스프링", emailAddress: "spring@example.com", phoneNumber: "010-3333-4444" },
];

/**
 * ★★ Reducer 함수 — 이 페이지의 심장.
 *
 * 규칙은 딱 하나다:
 *   (지금 상태, 요청서) 를 받아서 → (새로운 상태) 를 돌려준다.
 *
 * 반드시 지켜야 할 조건:
 *   1) 순수 함수여야 한다. 같은 입력이면 항상 같은 출력.
 *      안에서 API를 부르거나 localStorage에 쓰거나 하면 안 된다.
 *   2) 기존 상태를 직접 고치지 않고 새 배열/객체를 만들어 돌려준다. (불변성)
 *
 * 이 두 규칙을 지키면 테스트가 아주 쉬워진다.
 * 화면을 띄우지 않고도 이렇게 검사할 수 있다:
 *   contactReducer([], { type: "CREATE", contactItem: {...} })
 */
const contactReducer = (contactItems: ContactItem[], contactAction: ContactAction): ContactItem[] => {
  // 학습용 로그. 개발자도구 콘솔을 열어 두고 버튼을 눌러 보면
  // "어떤 요청이 들어왔고 그 전 상태가 무엇이었는지"가 그대로 찍힌다.
  // useReducer의 큰 장점이 바로 이런 추적 용이성이다.
  // (실무라면 applicationLogger를 쓰겠지만, 여기서는 눈에 잘 띄라고 console.log를 썼다)
  console.log("[contactReducer] Action 처리", { contactAction, previousContactItems: contactItems });

  // switch: action.type 값에 따라 갈라지는 분기문.
  // if-else를 여러 번 쓰는 것보다 "여러 경우 중 하나"라는 의도가 잘 드러난다.
  switch (contactAction.type) {
    case "CREATE":
      // Todo 페이지의 추가와 똑같은 패턴이다. 기존 것 펼치고 뒤에 새 것 붙이기.
      return [...contactItems, contactAction.contactItem];

    case "UPDATE":
      // id가 같은 것만 새 객체로 교체한다.
      // Todo 때와 달리 `{...기존, 바꿀것}`이 아니라 통째로 갈아 끼운다.
      // 폼에서 모든 항목을 다 받아 왔기 때문에 그래도 된다.
      return contactItems.map((contactItem) => (
        contactItem.contactId === contactAction.contactItem.contactId
          ? contactAction.contactItem
          : contactItem
      ));

    case "DELETE":
      // 해당 id가 아닌 것만 남긴다.
      return contactItems.filter((contactItem) => contactItem.contactId !== contactAction.contactId);

    case "RESET":
      // 목록을 통째로 교체한다. (지금 화면에서는 안 쓰지만, 확장을 대비해 남겨 뒀다)
      return contactAction.contactItems;

    default:
      // ★ default가 왜 필요한가?
      //   위 네 가지에 안 걸리는 요청이 들어와도 앱이 죽지 않게 하는 안전망이다.
      //   중요한 건 "아무것도 안 한다"가 아니라 "기존 상태를 그대로 돌려준다"는 점이다.
      //   여기서 undefined를 반환하면 상태가 통째로 사라져 화면이 깨진다.
      return contactItems;
  }
};

/**
 * localStorage에서 저장된 연락처를 읽어 온다.
 *
 * ★ try/catch가 반드시 필요한 이유
 *   JSON.parse는 문자열이 올바른 JSON이 아니면 에러를 던진다.
 *   저장소 값은 사용자가 개발자도구로 얼마든지 망가뜨릴 수 있고,
 *   예전 버전에서 다른 형식으로 저장해 뒀을 수도 있다.
 *
 *   에러를 안 잡으면 앱이 켜지자마자 흰 화면으로 죽는다.
 *   더 나쁜 건, 사용자가 원인을 알 수도 고칠 수도 없다는 점이다.
 *   그래서 "깨졌으면 기본값으로 시작한다"는 방어 코드를 넣는다.
 */
const loadStoredContacts = (): ContactItem[] => {
  const storedContacts = localStorage.getItem(CONTACT_STORAGE_KEY);
  // 저장된 게 아예 없으면(첫 방문) 샘플 데이터로 시작.
  if (!storedContacts) return initialContacts;

  try {
    // `as ContactItem[]`는 "이 타입이라고 믿겠다"는 선언일 뿐,
    // 실제로 검사하지는 않는다는 점에 주의하자.
    // 더 엄격하게 하려면 applicationEnvironment.ts처럼 Zod로 검증하면 된다.
    // (여기서는 학습 단계라 이 정도로 두었다)
    return JSON.parse(storedContacts) as ContactItem[];
  } catch {
    // catch 뒤에 (error) 를 안 적었다.
    // 오류 내용을 안 쓰고 "실패하면 기본값" 이라는 처리만 할 때 쓰는 문법이다.
    return initialContacts;
  }
};

export const ContactPracticePage = () => {
  // ── useReducer 사용법 ───────────────────────────────────────────
  //
  //   const [상태, dispatch] = useReducer(reducer함수, 초기값, 초기값만드는함수?)
  //
  //   dispatch는 "요청서를 보내는 함수"다. 이름 그대로 '발송한다'는 뜻.
  //   dispatch({ type: "DELETE", contactId: 3 }) 처럼 부르면
  //   React가 그 요청서를 reducer에 전달하고, 반환된 값을 새 상태로 삼는다.
  //
  // ★ 세 번째 인자(loadStoredContacts)가 있는 형태에 주목.
  //   두 번째 인자로 undefined를 주고 세 번째에 함수를 주면
  //   React가 "맨 처음 한 번만" 그 함수를 실행해 초기값을 만든다.
  //   localStorage 읽기는 느린 작업이라, 화면을 다시 그릴 때마다 하면 낭비다.
  //   (useState에 함수를 넘기는 lazy initializer와 완전히 같은 원리다)
  const [contactItems, dispatchContactAction] = useReducer(contactReducer, undefined, loadStoredContacts);

  // 아래 다섯 개는 화면 조작용 값이라 useReducer가 아니라 useState로 둔다.
  //
  // ★ 판단 기준: "여러 곳에서 복잡한 규칙으로 바뀌는가?"
  //   연락처 목록 → 추가/수정/삭제 규칙이 얽힘 → useReducer
  //   검색어, 입력칸 → 그냥 넣고 빼는 게 전부 → useState
  //   무조건 하나로 통일할 필요는 없다. 성격에 맞게 나누는 게 좋다.
  const [searchKeyword, setSearchKeyword] = useState("");
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactName, setContactName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // ── useEffect로 localStorage와 동기화 ───────────────────────────
  //
  // "연락처 목록이 바뀔 때마다 저장소에도 반영한다"는 뜻이다.
  //
  // ★ 왜 reducer 안에서 저장하지 않았을까?
  //   reducer는 순수 함수여야 한다는 규칙 때문이다.
  //   localStorage에 쓰는 건 "바깥 세상을 바꾸는 일(부수 효과)"이라 규칙 위반이다.
  //   이런 일은 useEffect가 맡는다. 역할을 나누는 것이 React의 설계 철학이다.
  //
  // ★ 왜 저장 함수를 만들어 여기저기서 부르지 않을까?
  //   그러면 새 기능을 추가할 때마다 저장 호출을 빠뜨릴 위험이 있다.
  //   "목록이 바뀌면 무조건 저장"이라고 한 곳에 적어 두면 절대 빠뜨릴 수 없다.
  useEffect(() => {
    // JSON.stringify: 객체/배열을 문자열로 바꾼다. localStorage는 문자열만 저장할 수 있다.
    // (읽을 때 JSON.parse로 되돌리는 것과 짝을 이룬다)
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contactItems));
    console.log("[ContactPracticePage] localStorage 저장", { contactCount: contactItems.length });
    // contactItems가 바뀔 때만 실행. 검색어를 아무리 쳐도 저장은 일어나지 않는다.
  }, [contactItems]);

  // ── 검색 필터링 ─────────────────────────────────────────────────
  const filteredContactItems = useMemo(() => {
    // 검색어를 다듬는다. 두 가지를 한 번에 한다.
    //   trim()       : 앞뒤 공백 제거 (실수로 스페이스를 친 경우 대비)
    //   toLowerCase(): 소문자로 통일
    //
    // ★ 왜 소문자로 바꾸나?
    //   "REACT"로 검색해도 "react@example.com"이 나오게 하려면
    //   비교하는 양쪽을 같은 형태로 맞춰야 한다.
    //   한쪽만 소문자로 바꾸면 대문자로 검색했을 때 아무것도 안 나온다.
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();

    return contactItems.filter((contactItem) => (
      // `||` = 둘 중 하나라도 맞으면 통과. 이름 또는 이메일로 찾을 수 있다.
      // includes: 문자열 안에 그 글자가 들어 있는지 확인한다. (부분 일치 검색)
      //
      // 참고: 검색어가 빈 문자열이면 includes("")는 항상 true다.
      //      그래서 검색어를 지우면 자동으로 전체가 보인다. 별도 처리가 필요 없다.
      contactItem.contactName.toLowerCase().includes(normalizedSearchKeyword)
      || contactItem.emailAddress.toLowerCase().includes(normalizedSearchKeyword)
    ));
  }, [contactItems, searchKeyword]);

  /** 폼의 모든 입력칸과 수정 상태를 초기화한다. */
  const clearForm = (): void => {
    // ★ 이런 걸 함수로 빼 두면 좋은 이유
    //   등록 후에도, 취소 버튼을 눌러도, 똑같이 네 줄을 실행해야 한다.
    //   함수로 만들어 두면 한 줄만 부르면 되고, 나중에 입력칸이 하나 늘어도
    //   여기 한 곳만 고치면 모든 곳에 반영된다.
    setEditingContactId(null);
    setContactName("");
    setEmailAddress("");
    setPhoneNumber("");
  };

  /**
   * 【Create + Update】 등록과 수정을 한 함수로 처리한다.
   *
   * ★ 왜 하나로 합쳤나?
   *   입력값 검사, 공백 제거, 폼 초기화 같은 과정이 거의 똑같기 때문이다.
   *   따로 만들면 같은 코드를 두 번 쓰게 되고, 한쪽만 고치는 실수가 생긴다.
   *   editingContactId가 있느냐 없느냐로 둘을 구분한다.
   */
  const saveContact = (): void => {
    // 필수 입력 검사. 전화번호는 없어도 되므로 검사하지 않는다.
    if (!contactName.trim() || !emailAddress.trim()) {
      applicationNotification.warning("이름과 이메일을 입력해 주세요.");
      return;
    }

    const contactItem: ContactItem = {
      // ★ `??` 로 id를 정하는 방식이 영리하다.
      //   수정 중이면 → 기존 id를 그대로 유지 (그래야 그 항목이 교체된다)
      //   새로 만드는 중이면 → editingContactId가 null이므로 새 id 생성
      contactId: editingContactId ?? Date.now(),
      // 저장할 때도 trim()을 한다. 앞뒤 공백이 데이터에 섞여 들어가면
      // 나중에 검색이나 정렬이 이상해진다. "입구에서 정리한다"는 원칙이다.
      contactName: contactName.trim(),
      emailAddress: emailAddress.trim(),
      phoneNumber: phoneNumber.trim(),
    };

    // ★ 여기가 useReducer의 정수다.
    //   이 컴포넌트는 map이나 filter를 전혀 모른다.
    //   그냥 "수정해줘" 또는 "만들어줘"라는 요청서를 보낼 뿐이고,
    //   실제로 배열을 어떻게 바꿀지는 reducer가 알아서 한다.
    //   화면 코드와 상태 로직이 깔끔하게 분리된 모습이다.
    dispatchContactAction({ type: editingContactId ? "UPDATE" : "CREATE", contactItem });

    applicationNotification.success(editingContactId ? "연락처를 수정했습니다." : "연락처를 등록했습니다.");
    clearForm();
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-초급">초급+</span>
          <h1>연락처 Reducer CRUD</h1>
          <p>여러 상태 변경 규칙을 Reducer에 모으고 새로고침 후에도 localStorage에서 복원합니다.</p>
        </div>
      </div>

      <div className="split-practice-layout">
        {/* ── 왼쪽: 등록/수정 폼 ─────────────────────────────────── */}
        <article className="practice-card sticky-form-card">
          {/* 제목도 모드에 따라 바뀐다. 사용자가 지금 뭘 하는 중인지 알려 주는 작은 배려다. */}
          <h2>{editingContactId ? "연락처 수정" : "연락처 등록"}</h2>

          {/* ★ <label> 안에 <input>을 넣은 구조에 주목.
              이렇게 감싸면 "이름"이라는 글자를 클릭해도 입력창에 커서가 간다.
              별도의 htmlFor/id 연결 없이 자동으로 짝지어진다.
              클릭 영역이 넓어져 편하고, 화면 낭독기도 "이름, 입력창"이라고 읽어 준다. */}
          <label>이름<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>

          {/* type="email": 모바일에서 @가 있는 키보드가 뜨고,
              폼 전송 시 브라우저가 기본 형식 검사를 해 준다. */}
          <label>이메일<input type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} /></label>
          <label>전화번호<input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>

          <div className="button-row">
            <button type="button" onClick={saveContact}>{editingContactId ? "수정 저장" : "등록"}</button>
            {/* 취소 버튼은 수정 중일 때만 보여준다.
                새로 등록하는 중에는 취소할 대상이 없으니 버튼도 필요 없다.
                "지금 할 수 없는 동작은 아예 안 보여주는" 것이 좋은 UI다. */}
            {editingContactId ? <button type="button" className="ghost-button" onClick={clearForm}>취소</button> : null}
          </div>
        </article>

        <div>
          <label className="search-field">
            연락처 검색
            <input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="이름 또는 이메일" />
          </label>
          <div className="contact-card-grid">
            {filteredContactItems.map((contactItem) => (
              <article className="contact-card" key={contactItem.contactId}>
                {/* slice(0, 1): 이름의 첫 글자만 잘라 동그란 아바타에 넣는다.
                    "김리액트" → "김". 프로필 사진이 없을 때 흔히 쓰는 방법이다. */}
                <div className="avatar-circle">{contactItem.contactName.slice(0, 1)}</div>
                <div className="contact-card-content">
                  <strong>{contactItem.contactName}</strong>
                  <span>{contactItem.emailAddress}</span>
                  {/* `||` 로 빈 값일 때 대체 문구를 보여준다.
                      전화번호가 ""이면 아무것도 안 보여서 줄이 비어 어색해진다.
                      여기서는 빈 문자열도 걸러야 하므로 `??`가 아니라 `||`가 맞다.
                      (`??`는 null/undefined만 걸러서 ""는 그대로 통과시킨다) */}
                  <span>{contactItem.phoneNumber || "전화번호 없음"}</span>
                </div>
                <div className="button-row compact-button-row">
                  {/* 수정 버튼: 이 항목의 값들을 왼쪽 폼에 그대로 채워 넣는다.
                      "수정 모드로 들어간다 = 폼에 기존 값을 복사한다"고 이해하면 된다. */}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setEditingContactId(contactItem.contactId);
                      setContactName(contactItem.contactName);
                      setEmailAddress(contactItem.emailAddress);
                      setPhoneNumber(contactItem.phoneNumber);
                    }}
                  >수정</button>

                  {/* 삭제 버튼: dispatch 한 번이면 끝난다.
                      Todo 페이지에서는 여기에 filter 로직이 그대로 들어 있었지만,
                      reducer로 옮겼기 때문에 화면 코드는 "의도"만 적으면 된다.
                      이게 useReducer를 쓰는 진짜 이유다.

                      ★ 실무라면 삭제 전에 ConfirmDialog로 한 번 물어보는 게 좋다.
                        실수로 눌렀을 때 되돌릴 방법이 없기 때문이다.
                        (shared/ui/ConfirmDialog.tsx를 참고하자) */}
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => dispatchContactAction({ type: "DELETE", contactId: contactItem.contactId })}
                  >삭제</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
