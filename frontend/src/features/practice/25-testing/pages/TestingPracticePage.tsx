/**
 * ============================================================================
 * TestingPracticePage.tsx — 【고급】 Vitest·Testing Library로 테스트 작성하기
 * ============================================================================
 *
 * 왼쪽은 테스트 대상(주문 금액 계산기), 아래는 그 계산기의 "실제 테스트 파일" 내용이다.
 * `?raw`를 붙여 import하면 Vite가 파일 내용을 문자열로 가져온다. 테스트 파일을 고치면 이 화면도 같이 바뀐다.
 *
 * [테스트를 나누는 기준]
 *   순수 함수(checkoutPrice.ts) → 규칙·경계값을 빠르고 촘촘하게
 *   컴포넌트(CheckoutCalculator) → 사용자 입장의 흐름 몇 개만
 *   "계산 규칙을 화면 밖으로 빼면" 대부분의 경우를 빠른 순수 함수 테스트로 확인할 수 있다.
 *
 * [직접 해 보기]
 *   frontend 폴더에서 npm run test -- 25-testing 을 실행하고, 규칙을 일부러 틀리게 바꿔 테스트가 잡는지 확인한다.
 */

import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { HighlightedCode } from "@/shared/ui/HighlightedTextarea";
import { CheckoutCalculator } from "@/features/practice/25-testing/components/CheckoutCalculator";
import checkoutCalculatorTestSource from "@/features/practice/25-testing/components/CheckoutCalculator.test.tsx?raw";

// 화면에 보여 줄 테스트 요령. 데이터 배열로 두고 map으로 그리면 항목을 추가하기 쉽다.
const testingTips = [
  { title: "사용자처럼 찾기", body: "getByRole(\"textbox\", { name: \"쿠폰 코드\" })처럼 역할·라벨로 찾는다. 클래스 이름은 디자인이 바뀌면 깨진다." },
  { title: "결과를 확인하기", body: "함수가 몇 번 불렸는지보다 화면에 무엇이 보이는지를 확인한다. 구현을 바꿔도 테스트가 유지된다." },
  { title: "경계값 넣기", body: "29,999원과 30,000원처럼 규칙이 바뀌는 바로 앞뒤 값을 꼭 넣는다. 버그는 대부분 경계에서 난다." },
  { title: "비동기는 기다리기", body: "서버 응답 뒤에 나타나는 요소는 findBy…로 기다린다. getBy…는 지금 바로 없으면 실패한다." },
];

export const TestingPracticePage = () => (
  <section>
    <div className="page-heading-row">
      <div>
        <span className="level-badge level-고급">고급</span>
        <LearningGuideTitle guideId="testing">Vitest·Testing Library로 테스트 작성하기</LearningGuideTitle>
        <p>계산 규칙은 순수 함수로, 화면은 사용자 흐름으로 나눠 테스트합니다. 아래는 이 계산기의 실제 테스트 코드입니다.</p>
      </div>
    </div>

    <div className="split-practice-layout">
      <CheckoutCalculator />
      <article className="practice-card">
        <h2>테스트 작성 요령</h2>
        <dl className="practice-testing-tips">
          {testingTips.map((tip) => <div key={tip.title}><dt>{tip.title}</dt><dd>{tip.body}</dd></div>)}
        </dl>
      </article>
    </div>

    <article className="practice-card practice-code-card">
      <h2>CheckoutCalculator.test.tsx</h2>
      {/* 긴 코드 블록은 가로 스크롤이 생기므로 tabIndex로 키보드 포커스를 받게 해 키보드로도 스크롤할 수 있게 한다. */}
      <HighlightedCode tabIndex={0} aria-label="계산기 테스트 코드" language="typescript" code={checkoutCalculatorTestSource} />
    </article>
  </section>
);
