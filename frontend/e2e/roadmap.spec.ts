/**
 * ============================================================================
 * roadmap.spec.ts — 학습 로드맵 화면 스모크 테스트
 * ============================================================================
 *
 * 확인하는 것:
 *   1. /react 첫 화면이 열리고 브라우저 탭 제목이 바뀐다 (DocumentTitle 컴포넌트)
 *   2. 예전 주소 /learning-roadmap이 새 주소 /react로 옮겨진다 (<Navigate replace />)
 *   3. 카드의 "단계 시작하기" 링크로 실습 화면에 들어간다 (지연 로딩된 페이지가 실제로 뜨는지)
 *   4. 완료 표시가 localStorage에 저장되어 새로고침 후에도 남는다
 *
 * ★ Playwright는 테스트마다 새 브라우저 컨텍스트(시크릿 창과 비슷)를 연다.
 *   그래서 4번에서 저장한 localStorage가 다른 테스트로 새지 않는다.
 */

import { expect, test } from "./fixtures";

test.describe("학습 로드맵", () => {
  test("첫 화면과 예전 주소 이동", async ({ page }) => {
    await page.goto("/learning-roadmap");

    // toHaveURL은 주소가 바뀔 때까지 기다렸다가 검사한다. (기본 5초)
    // ★ 그래서 waitForTimeout(1000)처럼 "대충 기다리기"를 쓰지 않아도 된다.
    //   고정 대기는 느린 PC에서는 부족하고 빠른 PC에서는 시간 낭비라 흔들리는 테스트의 주범이다.
    await expect(page).toHaveURL("/react");
    await expect(page).toHaveTitle(/전체 학습 로드맵/);
    await expect(
      page.getByRole("heading", { level: 1, name: "React 기초부터 실무 문제 해결까지 배우는 로드맵" }),
    ).toBeVisible();
  });

  test("단계 카드에서 실습 화면으로 들어간다", async ({ page }) => {
    await page.goto("/react");

    // ★ "단계 시작하기" 링크는 25개라 순서(nth)로 고르면 카드 순서가 바뀔 때 엉뚱한 단계를 누른다.
    //   제목이 들어 있는 카드(article)를 먼저 찾고, 그 안의 링크를 누르면 의도가 분명해진다.
    const todoStageCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "할 일 인라인 CRUD" }),
    });
    await todoStageCard.getByRole("link", { name: "단계 시작하기" }).click();

    await expect(page).toHaveURL("/react/todos");
    await expect(page.getByRole("heading", { name: "할 일 로컬 CRUD" })).toBeVisible();
  });

  test("완료 표시는 새로고침 후에도 유지된다", async ({ page }) => {
    await page.goto("/react");
    await expect(page.getByText("0 / 25단계 완료")).toBeVisible();

    const completeButton = page.getByRole("button", { name: "2단계 할 일 인라인 CRUD 완료 표시" });
    await completeButton.click();
    // aria-pressed: 눌림 상태를 화면 낭독기에 알리는 속성. 모양(CSS)이 아니라 이 값으로 상태를 검사한다.
    await expect(completeButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 / 25단계 완료")).toBeVisible();

    await page.reload();
    await expect(page.getByText("1 / 25단계 완료")).toBeVisible();
  });
});
