/**
 * ============================================================================
 * ReactFundamentalsPage.tsx — 【왕초보】 React의 4가지 기본기
 * ============================================================================
 *
 * ★★ React를 처음 배운다면 이 파일이 출발점이다.
 *   여기 나오는 네 가지를 이해하면 나머지 페이지의 90%를 읽을 수 있다.
 *
 * [React를 관통하는 단 하나의 원리]
 *
 *     사용자 행동 → 이벤트 함수 실행 → setState → 화면 다시 그리기
 *
 *   이게 전부다. 정말이다.
 *
 *   ★ 예전 방식(jQuery 등)과 무엇이 다른가?
 *     [옛날] "이 버튼을 누르면 저기 있는 글자를 3으로 바꿔라"
 *            → 화면을 직접 조작한다. 바꿀 곳이 많아지면 손댈 곳도 늘어난다.
 *     [React] "숫자는 3이다" 라고 값만 바꾼다.
 *            → 화면을 어떻게 바꿀지는 React가 알아서 한다.
 *
 *     개발자는 "화면을 어떻게 바꿀까"가 아니라
 *     "지금 데이터가 무엇인가"만 신경 쓰면 된다. 이게 React의 핵심 발상이다.
 *
 * [이 페이지에서 배우는 네 가지]
 *   1. useState 카운터   — State가 바뀌면 화면이 바뀐다
 *   2. 제어 컴포넌트     — 입력창의 값도 State로 관리한다
 *   3. 조건부 렌더링     — 조건에 따라 보여주거나 감춘다
 *   4. 배열 렌더링       — 목록을 .map()으로 그린다
 *
 * ★ 개발자도구(F12) 콘솔을 열어 두고 버튼을 눌러 보자.
 *   State가 바뀌는 과정이 로그로 찍힌다.
 */

import { useState } from "react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { applicationLogger } from "@/shared/logging/applicationLogger";

export const ReactFundamentalsPage = () => {
  // ── State 선언 ──────────────────────────────────────────────────
  //
  // [useState 읽는 법]
  //   const [값, 값을바꾸는함수] = useState(처음값);
  //          ↑     ↑                        ↑
  //       읽을 때  바꿀 때                  최초 1회만 사용
  //
  // ★ 왜 그냥 변수(let)를 쓰면 안 될까?
  //     let count = 0;
  //     count = 1;          → 값은 바뀌지만 화면은 그대로다!
  //   React는 화면을 다시 그릴 때 이 함수를 처음부터 다시 실행한다.
  //   그러면 let count = 0 도 다시 실행되어 값이 원래대로 돌아간다.
  //   useState는 React가 값을 따로 기억해 주고, 바뀌면 화면도 다시 그려 준다.

  const [counterValue, setCounterValue] = useState(0);
  const [learnerName, setLearnerName] = useState("");
  const [isExplanationVisible, setExplanationVisible] = useState(true);

  // ★ 이 줄은 좀 특이하다. 대괄호 안에 값만 있고 set 함수가 없다.
  //   `const [practiceTopics] = useState([...])`
  //   → "이 배열은 절대 안 바뀐다"는 뜻이다.
  //
  //   솔직히 이런 경우엔 useState 대신 그냥 상수로 두는 게 낫다:
  //     const practiceTopics = ["컴포넌트", ...];  ← 컴포넌트 바깥에
  //   여기서는 "배열도 State가 될 수 있다"를 보여주려고 이렇게 썼다.
  const [practiceTopics] = useState(["컴포넌트", "Props", "State", "Event", "Render"]);

  /**
   * 카운터를 1 증가시킨다.
   *
   * ★ 이 함수에는 초보자가 반드시 알아야 할 함정이 숨어 있다.
   *
   *   setCounterValue를 부른 "직후"에 counterValue를 읽으면
   *   여전히 옛날 값이 나온다! 예를 들어:
   *     setCounterValue(1);
   *     console.log(counterValue);  // → 0 이 찍힌다. 1이 아니다!
   *
   *   왜? State는 즉시 바뀌지 않고 "다음번 화면을 그릴 때" 반영되기 때문이다.
   *   지금 실행 중인 이 함수 안에서는 counterValue가 계속 옛 값이다.
   *
   *   그래서 아래처럼 nextCounterValue라는 변수를 따로 만들어
   *   로그에도 쓰고 setState에도 쓴다.
   */
  const increaseCounter = (): void => {
    const nextCounterValue = counterValue + 1;
    applicationLogger.info("[ReactFundamentalsPage] 카운터 증가", {
      previousCounterValue: counterValue,
      nextCounterValue,
    });
    setCounterValue(nextCounterValue);
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-왕초보">왕초보</span>
          <LearningGuideTitle guideId="fundamentals">React 기초 실습</LearningGuideTitle>
          <p>버튼과 입력값이 State를 바꾸고 화면이 다시 렌더링되는 과정을 확인합니다.</p>
        </div>
      </div>

      <div className="practice-example-grid">
        {/* ══════════════════════════════════════════════════════════
            예제 1. useState 카운터 — "값이 바뀌면 화면이 바뀐다"
            ══════════════════════════════════════════════════════════ */}
        <article className="practice-card">
          <h2>1. useState 카운터</h2>
          {/* JSX 안의 중괄호 `{}` = "여기부터 JavaScript".
              counterValue가 바뀔 때마다 이 자리 숫자가 저절로 바뀐다.
              우리가 "글자를 바꿔라"고 명령한 적이 없다는 점이 핵심이다. */}
          <p className="large-value">{counterValue}</p>
          <div className="button-row">
            {/* ★ onClick에는 "함수 자체"를 넘긴다. 괄호를 붙이면 안 된다.
                  onClick={increaseCounter}    ← 맞다 (클릭할 때 실행)
                  onClick={increaseCounter()}  ← 틀렸다 (그릴 때 바로 실행!)
                이건 초보자가 100% 한 번은 겪는 실수다. */}
            <button type="button" onClick={increaseCounter}>증가</button>

            {/* ★ 이 버튼은 위와 다른 방식을 쓴다. 비교해 보자.
                  setCounterValue((previousValue) => previousValue - 1)

                이걸 "함수형 업데이트"라고 한다.
                값 대신 함수를 넘기면, React가 "가장 최신 값"을 인자로 준다.

                왜 이게 더 안전한가?
                  setCounterValue(counterValue - 1) 는 지금 화면의 값을 기준으로 계산한다.
                  버튼을 아주 빠르게 여러 번 누르면 옛 값을 기준으로 계산해서
                  누른 횟수만큼 안 줄어들 수 있다.
                  함수형은 React가 직전 결과를 넣어 주므로 그런 문제가 없다.

                ★ 규칙: "이전 값을 기반으로 계산"할 때는 함수형을 쓰자. */}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setCounterValue((previousValue) => previousValue - 1)}
            >
              감소
            </button>

            {/* 초기화는 이전 값과 무관하게 무조건 0이므로 그냥 값을 넣어도 된다. */}
            <button type="button" className="ghost-button" onClick={() => setCounterValue(0)}>
              초기화
            </button>
          </div>
        </article>

        {/* ══════════════════════════════════════════════════════════
            예제 2. 제어 컴포넌트 — 입력창의 값도 State로 관리한다
            ══════════════════════════════════════════════════════════ */}
        <article className="practice-card">
          <h2>2. 제어 컴포넌트</h2>
          <label>
            이름
            {/* ★★ 제어 컴포넌트(controlled component)의 두 축.
                  value    : State 값을 입력창에 보여준다   (State → 화면)
                  onChange : 입력한 글자를 State에 저장한다 (화면 → State)

                두 개가 한 쌍으로 움직여야 한다.
                onChange를 빼면 글자를 쳐도 화면이 안 바뀐다.
                State가 안 바뀌니 value도 그대로이기 때문이다.
                (React가 "읽기 전용 입력창"이라고 경고까지 띄운다)

                ★ 이렇게 하는 이유
                  화면의 "진실"이 항상 State에 있게 된다.
                  버튼을 눌렀을 때 입력값을 알 수 있고,
                  코드로 입력창을 비우거나 채울 수도 있다. */}
            <input
              value={learnerName}
              onChange={(changeEvent) => {
                applicationLogger.info("[ReactFundamentalsPage] 이름 입력", {
                  // changeEvent.target = 이벤트가 일어난 요소(이 input)
                  // .value = 지금 그 안에 들어 있는 글자
                  changedLearnerName: changeEvent.target.value,
                });
                setLearnerName(changeEvent.target.value);
              }}
              placeholder="이름을 입력하세요"
            />
          </label>
          {/* 입력값이 있으면 인사말, 없으면 안내 문구.
              글자를 칠 때마다 이 문장이 실시간으로 바뀐다.
              백틱(`)으로 감싼 템플릿 리터럴 안에서 ${변수}로 값을 끼워 넣는다. */}
          <p>{learnerName ? `${learnerName}님, React 연습을 시작합니다.` : "입력값이 여기에 표시됩니다."}</p>
        </article>

        {/* ══════════════════════════════════════════════════════════
            예제 3. 조건부 렌더링 — 조건에 따라 보여주거나 감춘다
            ══════════════════════════════════════════════════════════ */}
        <article className="practice-card">
          <h2>3. 조건부 렌더링</h2>
          {/* true ↔ false 뒤집기. 여기서도 함수형 업데이트를 썼다.
              (visible) => !visible  → "지금 값의 반대로" */}
          <button type="button" onClick={() => setExplanationVisible((visible) => !visible)}>
            설명 {isExplanationVisible ? "숨기기" : "보기"}
          </button>

          {/* ★ `조건 ? 보여줄것 : null` 이 조건부 렌더링의 기본형이다.
                null을 반환하면 아무것도 안 그린다.

              ★★ 중요한 차이: CSS로 숨기는 것과 다르다!
                CSS display:none  → 요소는 있는데 눈에만 안 보인다
                null 반환         → 요소 자체가 DOM에 없다
                후자가 더 확실하다. 키보드 Tab으로도 접근되지 않고,
                화면 낭독기도 읽지 않는다.

              ※ `조건 && <컴포넌트/>` 로도 쓸 수 있지만 함정이 있다.
                조건이 숫자 0이면 화면에 "0"이 그대로 찍힌다.
                이 프로젝트가 삼항 연산자를 쓰는 이유다. */}
          {isExplanationVisible ? (
            <p className="notice-box">조건이 true일 때만 이 문장이 DOM에 렌더링됩니다.</p>
          ) : null}
        </article>

        {/* ══════════════════════════════════════════════════════════
            예제 4. 배열 렌더링 — 목록을 .map()으로 그린다
            ══════════════════════════════════════════════════════════ */}
        <article className="practice-card">
          <h2>4. 배열 렌더링</h2>
          <ul className="simple-list">
            {/* ★ .map()은 배열의 각 원소를 다른 값으로 바꿔 새 배열을 만든다.
                  ["컴포넌트", "Props"] → [<li>컴포넌트</li>, <li>Props</li>]
                React는 JSX 배열을 받으면 안의 것들을 차례로 화면에 그린다.

                for문을 쓰지 않는 이유:
                  JSX의 `{}` 안에는 "값"만 넣을 수 있고 "문장"은 못 넣는다.
                  for는 문장이고, map은 배열이라는 값을 만들어 낸다.

                두 번째 인자 topicIndex는 순서 번호(0부터)다.
                화면에 1번부터 보여주려고 +1 해서 쓴다. */}
            {practiceTopics.map((practiceTopic, topicIndex) => (
              // ★★ key는 목록을 그릴 때 반드시 필요하다.
              //   React가 "무엇이 추가/삭제/이동됐는지" 알아보는 이름표다.
              //   없으면 콘솔에 경고가 뜨고, 목록이 바뀔 때 이상하게 동작한다.
              //
              //   ★ key={topicIndex} 처럼 인덱스를 쓰면 안 되나?
              //     목록 순서가 절대 안 바뀐다면 괜찮다.
              //     하지만 중간에 삭제하거나 정렬하면 인덱스가 밀려서
              //     React가 엉뚱한 항목을 재사용해 버그가 난다.
              //     여기서는 항목 이름이 겹치지 않으므로 이름을 key로 썼다.
              <li key={practiceTopic}>
                <span>{topicIndex + 1}</span>
                {practiceTopic}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="code-flow-card">
        <h2>확인할 동작 흐름</h2>
        {/* ★ 이 한 줄이 React의 전부다. 외워 두면 좋다. */}
        <code>사용자 이벤트 → 이벤트 함수 실행 → setState → 컴포넌트 재렌더링 → 화면 변경</code>
      </article>
    </section>
  );
};
