/**
 * ============================================================================
 * fixtures.ts — 모든 E2E 테스트가 함께 쓰는 test 함수
 * ============================================================================
 *
 * [fixture(픽스처)란?]
 *   테스트마다 반복되는 "준비 → 검사 → 정리"를 한곳에 모아 둔 부품이다.
 *   Playwright가 기본으로 주는 `page`도 fixture 중 하나다.
 *   여기서는 기본 test를 확장(extend)해서 "화면에서 잡히지 않은 오류가 나면 실패" 규칙을 덧붙인다.
 *
 * [왜 이 규칙이 필요한가?]
 *   React 화면은 컴포넌트 하나가 터져도 다른 부분은 그대로 보일 수 있다.
 *   그러면 "제목이 보인다"만 검사하는 테스트는 통과해 버린다.
 *   브라우저의 pageerror(잡히지 않은 예외)를 모아 두었다가 테스트가 끝날 때 0개인지 확인하면,
 *   눈에 띄지 않는 런타임 오류도 스모크 테스트에서 걸러진다.
 *
 * 사용법: 각 spec 파일에서 "@playwright/test" 대신 "./fixtures"의 test·expect를 import한다.
 */

import { expect, test as baseTest } from "@playwright/test";

export const test = baseTest.extend<{ failOnUncaughtPageError: void }>({
  failOnUncaughtPageError: [
    async ({ page }, use) => {
      // 테스트가 도는 동안 발생한 오류 메시지를 담아 둘 배열
      const uncaughtErrorMessages: string[] = [];
      page.on("pageerror", (pageError) => uncaughtErrorMessages.push(pageError.message));

      // use() 앞은 "테스트 전 준비", 뒤는 "테스트 후 정리·검사"다.
      await use();

      // ★ toEqual([])로 비교하면 실패했을 때 어떤 오류였는지 메시지가 그대로 보고서에 찍힌다.
      //   toHaveLength(0)로 쓰면 "길이가 1이었다"만 나와 원인을 다시 찾아야 한다.
      expect(uncaughtErrorMessages, "화면에서 잡히지 않은 오류가 발생했습니다").toEqual([]);
    },
    // auto: true → 테스트가 이 fixture 이름을 적지 않아도 항상 자동으로 실행된다.
    { auto: true },
  ],
});

export { expect };
