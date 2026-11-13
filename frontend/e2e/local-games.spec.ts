import { test, expect } from "./fixtures";

test("부루마블에서 매입·차례 전환과 모바일 게임판을 확인한다", async ({ page }) => {
  await page.goto("/games");
  await page.getByRole("link", { name: /부루마블/ }).last().click();
  await expect(page.getByRole("heading", { level: 1, name: "부루마블" })).toBeVisible();
  await page.getByLabel("컴퓨터 수").selectOption("1");
  await page.getByRole("button", { name: "게임 시작", exact: true }).click();
  await page.getByRole("button", { name: "주사위 굴리기" }).click();
  const buy = page.getByRole("button", { name: /^땅 사기/ });
  if (await buy.count()) await buy.click();
  await page.getByRole("button", { name: "차례 마치기" }).click();
  await expect(page.getByRole("status")).toContainText("컴퓨터 1 차례");
  await expect(page.getByRole("status")).toContainText("나 차례", { timeout: 7000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("region", { name: "부루마블 게임판" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "../.local/marble-mobile.png", fullPage: true });
});

test("미로를 실제 키보드로 탈출하고 모바일 화면을 확인한다", async ({ page }) => {
  await page.goto("/games/maze");
  await page.getByLabel("난이도").selectOption("EASY");
  await page.getByRole("button", { name: "미로 시작", exact: true }).click();
  const region = page.getByRole("region", { name: "미로 키보드 조작 영역" });
  await expect(region).toBeFocused();
  // 렌더링된 벽만 읽고 독립적으로 길을 찾아 실제 키보드 입력을 보낸다.
  const keys = await page.locator(".maze-board").evaluate((svg) => {
    const size = Number(svg.getAttribute("viewBox")?.split(" ")[2]);
    const wallRects = svg.querySelectorAll<SVGRectElement>(".maze-wall");
    const walls = new Set(Array.from(wallRects).map((rect) => `${rect.getAttribute("y")}:${rect.getAttribute("x")}`));
    const queue = [{ row: 1, col: 1, keys: [] as string[] }];
    const seen = new Set(["1:1"]);
    for (let index = 0; index < queue.length; index += 1) {
      const point = queue[index]; if (!point) break;
      if (point.row === size - 2 && point.col === size - 2) return point.keys;
      for (const [row, col, key] of [[-1, 0, "ArrowUp"], [1, 0, "ArrowDown"], [0, -1, "ArrowLeft"], [0, 1, "ArrowRight"]] as const) {
        const next = { row: point.row + row, col: point.col + col }; const id = `${next.row}:${next.col}`;
        if (walls.has(id) || seen.has(id) || next.row < 0 || next.row >= size || next.col < 0 || next.col >= size) continue;
        seen.add(id); queue.push({ ...next, keys: [...point.keys, key] });
      }
    }
    throw new Error("화면 미로의 출구에 도달할 수 없습니다.");
  });
  await page.getByRole("button", { name: "위로 이동" }).focus();
  for (const key of keys) await page.keyboard.press(key);
  await expect(page.getByRole("heading", { name: "탈출 성공!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "오른쪽으로 이동" })).toBeDisabled();
  await page.screenshot({ path: "../.local/maze-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "../.local/maze-mobile.png", fullPage: true });
});
