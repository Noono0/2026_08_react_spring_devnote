/**
 * ============================================================================
 * todo.spec.ts — 2단계 할 일 CRUD를 실제 브라우저로 한 바퀴 돌려 보는 테스트
 * ============================================================================
 *
 * TodoPracticePage.test.tsx(Vitest)도 같은 기능을 검사한다. 무엇이 다를까?
 *   - Vitest: fireEvent.change로 값을 "직접 넣는다". 키보드 입력·포커스·CSS는 거치지 않는다.
 *   - Playwright: fill·press·click이 진짜 키보드·마우스 이벤트를 보낸다.
 *     버튼이 다른 요소에 가려져 있거나 화면 밖에 있으면 클릭이 실패해서 레이아웃 문제도 드러난다.
 *
 * ★ 화면 요소는 getByRole(역할 + 접근 가능한 이름)로 찾는다.
 *   CSS 클래스(.todo-item)로 찾으면 디자인만 바꿔도 테스트가 깨지고,
 *   역할로 찾으면 화면 낭독기 사용자가 쓰는 방식 그대로라 접근성까지 함께 검사된다.
 */

import { expect, test } from "./fixtures";

test("할 일을 추가·완료·수정·삭제한다", async ({ page }) => {
  await page.goto("/react/todos");

  // ── 추가(Create): Enter 키로 추가한다 ──
  const newTodoInput = page.getByRole("textbox", { name: "새 할 일" });
  await newTodoInput.fill("E2E 테스트 작성하기");
  await newTodoInput.press("Enter");
  await expect(page.getByText("E2E 테스트 작성하기")).toBeVisible();
  // 추가한 뒤 입력칸이 비워져야 다음 할 일을 바로 칠 수 있다.
  await expect(newTodoInput).toHaveValue("");

  // ── 완료 처리 후 "완료" 필터 ──
  await page.getByRole("checkbox", { name: "E2E 테스트 작성하기 완료 여부" }).check();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByText("E2E 테스트 작성하기")).toBeVisible();
  // 처음 데이터 중 완료되지 않은 항목은 "완료" 필터에서 사라져야 한다.
  await expect(page.getByText("배열 불변성 연습하기")).toBeHidden();
  await page.getByRole("button", { name: "전체", exact: true }).click();

  // ── 수정(Update): 인라인 편집 ──
  // 여러 "수정" 버튼 중 이 할 일의 카드(article)에 있는 버튼만 고른다.
  const createdTodoItem = page.locator("article").filter({ hasText: "E2E 테스트 작성하기" });
  await createdTodoItem.getByRole("button", { name: "수정" }).click();
  await page.getByRole("textbox", { name: "E2E 테스트 작성하기 수정 입력" }).fill("E2E 테스트 다듬기");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("E2E 테스트 다듬기")).toBeVisible();

  // ── 삭제(Delete) ──
  await page.locator("article").filter({ hasText: "E2E 테스트 다듬기" })
    .getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("E2E 테스트 다듬기")).toBeHidden();
});
