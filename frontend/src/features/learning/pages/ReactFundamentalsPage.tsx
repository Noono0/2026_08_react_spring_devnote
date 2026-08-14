import { useState } from "react";
import { applicationLogger } from "@/shared/logging/applicationLogger";

export const ReactFundamentalsPage = () => {
  const [counterValue, setCounterValue] = useState(0);
  const [learnerName, setLearnerName] = useState("");
  const [isExplanationVisible, setExplanationVisible] = useState(true);
  const [practiceTopics] = useState(["컴포넌트", "Props", "State", "Event", "Render"]);

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
          <h1>React 기초 실습</h1>
          <p>버튼과 입력값이 State를 바꾸고 화면이 다시 렌더링되는 과정을 확인합니다.</p>
        </div>
      </div>

      <div className="practice-example-grid">
        <article className="practice-card">
          <h2>1. useState 카운터</h2>
          <p className="large-value">{counterValue}</p>
          <div className="button-row">
            <button type="button" onClick={increaseCounter}>증가</button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setCounterValue((previousValue) => previousValue - 1)}
            >
              감소
            </button>
            <button type="button" className="ghost-button" onClick={() => setCounterValue(0)}>
              초기화
            </button>
          </div>
        </article>

        <article className="practice-card">
          <h2>2. 제어 컴포넌트</h2>
          <label>
            이름
            <input
              value={learnerName}
              onChange={(changeEvent) => {
                applicationLogger.info("[ReactFundamentalsPage] 이름 입력", {
                  changedLearnerName: changeEvent.target.value,
                });
                setLearnerName(changeEvent.target.value);
              }}
              placeholder="이름을 입력하세요"
            />
          </label>
          <p>{learnerName ? `${learnerName}님, React 연습을 시작합니다.` : "입력값이 여기에 표시됩니다."}</p>
        </article>

        <article className="practice-card">
          <h2>3. 조건부 렌더링</h2>
          <button type="button" onClick={() => setExplanationVisible((visible) => !visible)}>
            설명 {isExplanationVisible ? "숨기기" : "보기"}
          </button>
          {isExplanationVisible ? (
            <p className="notice-box">조건이 true일 때만 이 문장이 DOM에 렌더링됩니다.</p>
          ) : null}
        </article>

        <article className="practice-card">
          <h2>4. 배열 렌더링</h2>
          <ul className="simple-list">
            {practiceTopics.map((practiceTopic, topicIndex) => (
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
        <code>사용자 이벤트 → 이벤트 함수 실행 → setState → 컴포넌트 재렌더링 → 화면 변경</code>
      </article>
    </section>
  );
};
