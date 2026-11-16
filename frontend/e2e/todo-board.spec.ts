import { test, expect } from "./fixtures";
import { randomBytes, randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

interface TodoInput { title: string; content: string; completed: boolean; versionNumber?: number; reminderTimes?: string[] }
interface Reminder { reminderId: number; scheduledAt: string; status: "PENDING" | "CANCELLED" }
interface Todo extends TodoInput { todoId: number; versionNumber: number; createdAt: string; updatedAt: string; reminders?: Reminder[] }
interface LoginFixture { authenticated: boolean; account: Todo[]; mergeCalls: number }

test("개인 TODO 게시판에서 등록·완료·검색·수정·삭제하고 모바일 화면을 확인한다", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("devnoteDataSource", "backend"));
  await page.route("**/api/v1/board-todos/push", (route) => route.fulfill({ json: { data: { configured: false, publicKey: "", subscribed: false } } }));
  // 실제 브라우저 UI 검증용 세션·API다. 서버 작성자 격리는 MySQL·MockMvc 통합 테스트에서 확인한다.
  await page.route("**/api/v1/auth/session", (route) => route.fulfill({ json: { data: {
    authenticated: true, memberId: 2, memberName: "TODO 사용자", loginId: "todo-test", role: "USER", grade: "BRONZE", administrator: false, superAdministrator: false,
  } } }));
  await page.route("**/api/v1/board-todos/owner", (route) => route.fulfill({ json: { data: { mode: "MEMBER", cacheKey: "member:2" } } }));
  let rows: Todo[] = [];
  let nextId = 1;
  await page.route(/\/api\/v1\/board-todos(?:\/\d+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET") {
      const state = url.searchParams.get("status");
      const keyword = url.searchParams.get("keyword") ?? "";
      const content = rows.filter((todo) => (state === "ALL" || todo.completed === (state === "DONE")) && `${todo.title} ${todo.content}`.includes(keyword));
      await route.fulfill({ json: { data: { content, pageInformation: { pageNumber: 0, pageSize: 12, totalElements: content.length, totalPages: content.length ? 1 : 0, firstPage: true, lastPage: true } } } });
    } else if (request.method() === "POST") {
      const input = request.postDataJSON() as TodoInput;
      const created: Todo = { ...input, todoId: nextId++, versionNumber: 1, createdAt: "2026-11-16T09:00:00", updatedAt: "2026-11-16T09:00:00",
        reminders: (input.reminderTimes ?? []).map((scheduledAt, index) => ({ reminderId: index + 1, scheduledAt, status: "PENDING" })) };
      rows = [...rows, created]; await route.fulfill({ status: 201, json: { data: created } });
    } else if (request.method() === "PUT") {
      const input = request.postDataJSON() as TodoInput;
      const todoId = Number(url.pathname.split("/").at(-1));
      rows = rows.map((todo) => todo.todoId === todoId ? { ...todo, ...input, versionNumber: todo.versionNumber + 1,
        reminders: (input.reminderTimes ? input.reminderTimes.map((scheduledAt, index) => ({ reminderId: index + 1, scheduledAt, status: "PENDING" as const })) : todo.reminders ?? [])
          .map((reminder) => ({ ...reminder, status: input.completed ? "CANCELLED" : reminder.status })) } : todo);
      await route.fulfill({ json: { data: rows.find((todo) => todo.todoId === todoId) } });
    } else if (request.method() === "DELETE") {
      rows = rows.filter((todo) => todo.todoId !== Number(url.pathname.split("/").at(-1)));
      await route.fulfill({ status: 204 });
    } else await route.abort();
  });
  await page.goto("/react/boards");
  await page.getByRole("link", { name: "TODO 리스트", exact: true }).click();
  await expect(page.getByRole("heading", { name: "TODO 리스트 게시판" })).toBeVisible();
  await page.getByRole("button", { name: "할 일 추가" }).click();
  await page.getByLabel("할 일 제목 *").fill("TODO API 학습");
  await page.getByLabel("메모", { exact: true }).fill("내 계정에만 보이는 메모");
  const times = await page.evaluate(() => [1, 2].map((days) => {
    const date = new Date(Date.now() + days * 86400000); date.setSeconds(0, 0);
    const pad = (number: number) => String(number).padStart(2, "0");
    return { local: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`, utc: date.toISOString() };
  }));
  for (let index = 0; index < times.length; index += 1) {
    await page.getByRole("button", { name: "알림 시간 추가" }).click();
    await page.getByLabel(`알림 시간 ${index + 1}`, { exact: true }).fill(times[index]?.local ?? "");
  }
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(rows[0]?.reminders?.map((reminder) => reminder.scheduledAt)).toEqual(times.map((time) => time.utc));
  await expect(page.getByRole("list", { name: "TODO API 학습 알림 시간" }).getByRole("listitem")).toHaveCount(2);
  const changed = page.waitForResponse((response) => response.url().includes("/board-todos/") && response.request().method() === "PUT", { timeout: 8000 });
  await page.getByRole("checkbox", { name: "TODO API 학습 완료", exact: true }).click();
  const changedResponse = await changed;
  expect(changedResponse.status()).toBe(200);
  await expect(page.getByRole("checkbox", { name: "TODO API 학습 완료", exact: true })).toBeChecked();
  await page.getByLabel("할 일 상태").selectOption("DONE");
  await page.getByLabel("제목·메모 검색").fill("API");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByRole("button", { name: "TODO API 학습 수정" }).click();
  await expect(page.getByLabel("알림 시간 1", { exact: true })).toHaveValue(times[0]?.local ?? "");
  await page.getByRole("button", { name: "알림 시간 2 삭제" }).click();
  await page.getByLabel("할 일 제목 *").fill("TODO API 복습");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "TODO API 복습 알림 시간" }).getByRole("listitem")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "../.local/todo-board-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "TODO API 복습 삭제" }).click();
  await page.getByRole("button", { name: "삭제하기", exact: true }).click();
  await expect(page.getByText(/표시할 할 일이 없습니다/)).toBeVisible();
});

async function guestApi(context: BrowserContext, buckets: Map<string, { publicId: string; rows: Todo[] }>,
  login: LoginFixture = { authenticated: false, account: [], mergeCalls: 0 }) {
  await context.addInitScript(() => localStorage.setItem("devnoteDataSource", "backend"));
  await context.route("**/api/v1/board-todos/push", (route) => route.fulfill({ json: { data: { configured: false, publicKey: "", subscribed: false } } }));
  const session = () => login.authenticated
    ? { authenticated: true, memberId: 2, memberName: "병합 회원", loginId: "mergeuser", role: "USER", grade: "BRONZE", administrator: false, superAdministrator: false }
    : { authenticated: false, memberName: "", administrator: false, superAdministrator: false };
  await context.route("**/api/v1/auth/session", (route) => {
    if (route.request().method() === "DELETE") login.authenticated = false;
    return route.fulfill({ json: { data: session() } });
  });
  await context.route("**/api/v1/auth/login", (route) => { login.authenticated = true; return route.fulfill({ json: { data: session() } }); });
  await context.route(/\/api\/v1\/board-todos(?:\/(?:owner|guest-merge|\d+))?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let token = request.headers().cookie?.match(/(?:^|;\s*)DEVNOTE_TODO_GUEST=([A-Za-z0-9_-]+)/)?.[1] ?? "";
    if (url.pathname.endsWith("/owner")) {
      if (login.authenticated) { await route.fulfill({ json: { data: { mode: "MEMBER", cacheKey: "member:2" } } }); return; }
      if (!buckets.has(token)) { token = randomBytes(32).toString("base64url"); buckets.set(token, { publicId: randomUUID(), rows: [] }); }
      const bucket = buckets.get(token);
      if (!bucket) throw new Error("비회원 테스트 소유자가 없습니다.");
      await route.fulfill({ headers: { "Set-Cookie": `DEVNOTE_TODO_GUEST=${token}; Path=/api/v1/board-todos; HttpOnly; SameSite=Strict; Max-Age=31536000` },
        json: { data: { mode: "GUEST", cacheKey: `guest:${bucket.publicId}` } } });
      return;
    }
    const bucket = buckets.get(token);
    if (url.pathname.endsWith("/guest-merge")) {
      if (!login.authenticated) { await route.fulfill({ status: 401, json: { status: 401, errorCode: "AUTHENTICATION_REQUIRED", detail: "로그인 필요", fieldErrors: [] } }); return; }
      if (request.method() === "GET") {
        await route.fulfill({ json: { data: { count: bucket?.rows.length ?? 0, guestKey: bucket ? `guest:${bucket.publicId}` : null,
          throughTodoId: Math.max(0, ...(bucket?.rows.map((todo) => todo.todoId) ?? [])) } } });
      } else {
        const input = request.postDataJSON() as { expectedMemberId: number; guestKey: string; throughTodoId: number };
        if (!bucket || input.expectedMemberId !== 2 || input.guestKey !== `guest:${bucket.publicId}`) {
          await route.fulfill({ status: 409, json: { status: 409, errorCode: "TODO_MERGE_CONTEXT_CHANGED", detail: "계정 변경", fieldErrors: [] } }); return;
        }
        const moved = bucket.rows.filter((todo) => todo.todoId <= input.throughTodoId).map((todo) => ({ ...todo, versionNumber: todo.versionNumber + 1 }));
        login.account = [...login.account, ...moved]; bucket.rows = bucket.rows.filter((todo) => todo.todoId > input.throughTodoId); login.mergeCalls += 1;
        await route.fulfill({ json: { data: { mergedCount: moved.length } } });
      }
      return;
    }
    if (!bucket && !login.authenticated) { await route.fulfill({ status: 400, json: { status: 400, errorCode: "TODO_GUEST_COOKIE_REQUIRED", detail: "쿠키를 허용해 주세요.", fieldErrors: [] } }); return; }
    const rows = login.authenticated ? login.account : bucket?.rows ?? [];
    if (request.method() === "GET") {
      await route.fulfill({ json: { data: { content: rows, pageInformation: { pageNumber: 0, pageSize: 12, totalElements: rows.length,
        totalPages: rows.length ? 1 : 0, firstPage: true, lastPage: true } } } });
    } else if (request.method() === "POST") {
      const input = request.postDataJSON() as TodoInput;
      const todoId = Math.max(0, ...login.account.map((todo) => todo.todoId), ...Array.from(buckets.values()).flatMap((value) => value.rows.map((todo) => todo.todoId))) + 1;
      const todo: Todo = { ...input, todoId, versionNumber: 1, createdAt: "2026-11-16T09:00:00", updatedAt: "2026-11-16T09:00:00" };
      if (login.authenticated) login.account = [...login.account, todo];
      else if (bucket) bucket.rows = [...bucket.rows, todo];
      await route.fulfill({ status: 201, json: { data: todo } });
    } else await route.abort();
  });
}

test("로그인 없이 같은 브라우저의 목록을 유지하고 다른 브라우저·쿠키 삭제 시 분리한다", async ({ page, context, browser, baseURL }) => {
  const buckets = new Map<string, { publicId: string; rows: Todo[] }>();
  await guestApi(context, buckets);
  const other = await browser.newContext({ baseURL });
  try {
    await guestApi(other, buckets);
    await page.goto("/react/boards/todo");
    await expect(page.getByText(/비회원 · 이 브라우저의 할 일/)).toBeVisible();
    await expect(page.getByRole("button", { name: "할 일 추가" })).toBeEnabled();
    await page.getByRole("button", { name: "할 일 추가" }).click();
    await page.getByLabel("할 일 제목 *").fill("첫 브라우저의 할 일");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("첫 브라우저의 할 일", { exact: true })).toBeVisible();
    const cookie = (await context.cookies()).find((value) => value.name === "DEVNOTE_TODO_GUEST");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Strict");
    await page.reload();
    await expect(page.getByText("첫 브라우저의 할 일", { exact: true })).toBeVisible();
    const second = await other.newPage();
    await second.goto("/react/boards/todo");
    await expect(second.getByText(/표시할 할 일이 없습니다/)).toBeVisible();
    await expect(second.getByText("첫 브라우저의 할 일", { exact: true })).toHaveCount(0);
    await context.clearCookies(); await page.reload();
    await expect(page.getByText(/표시할 할 일이 없습니다/)).toBeVisible();
    await expect(page.getByText("첫 브라우저의 할 일", { exact: true })).toHaveCount(0);
  } finally { await other.close(); }
});

test("로그인 후 비회원 TODO 가져오기를 취소하면 보존하고 예를 선택하면 계정에 합친다", async ({ page, context }) => {
  const login: LoginFixture = { authenticated: false, mergeCalls: 0, account: [{ todoId: 99, title: "기존 계정 할 일", content: "기존 메모", completed: false,
    versionNumber: 1, createdAt: "2026-11-16T08:00:00", updatedAt: "2026-11-16T08:00:00" }] };
  await guestApi(context, new Map(), login);
  await page.goto("/react/boards/todo");
  await page.getByRole("button", { name: "할 일 추가" }).click();
  await page.getByLabel("할 일 제목 *").fill("로그인 전 할 일");
  await page.getByLabel("메모", { exact: true }).fill("가져와도 유지할 메모");
  await page.getByRole("checkbox", { name: "완료한 할 일", exact: true }).check();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("로그인 전 할 일", { exact: true })).toBeVisible();
  const signIn = async () => {
    await page.getByRole("button", { name: "로그인", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "로그인", exact: true });
    await dialog.getByLabel("아이디", { exact: true }).fill("mergeuser");
    await dialog.getByLabel("비밀번호", { exact: true }).fill("e2e-password");
    await dialog.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "비회원 TODO 가져오기", exact: true })).toBeVisible();
  };
  await signIn();
  await page.getByRole("button", { name: "아니요, 유지", exact: true }).click();
  expect(login.mergeCalls).toBe(0);
  await expect(page.getByText("기존 계정 할 일", { exact: true })).toBeVisible();
  await expect(page.getByText("로그인 전 할 일", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "로그아웃", exact: true }).first().click();
  await expect(page.getByText("로그인 전 할 일", { exact: true })).toBeVisible();
  await signIn();
  await page.screenshot({ path: "../.local/todo-merge-confirm.png", fullPage: true });
  await page.getByRole("button", { name: "예, 가져오기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("기존 계정 할 일", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "로그인 전 할 일 완료", exact: true })).toBeChecked();
  expect(login.mergeCalls).toBe(1);
  expect(login.account).toHaveLength(2);
  await page.getByRole("button", { name: "로그아웃", exact: true }).first().click();
  await expect(page.getByText(/표시할 할 일이 없습니다/)).toBeVisible();
});
