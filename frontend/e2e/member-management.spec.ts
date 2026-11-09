import { expect, test } from "./fixtures";

test("회원 그리드에서 분석·상세 수정과 내 계정 비밀번호 변경까지 이어진다", async ({ page }) => {
  // 온라인 E2E 서버에서도 이 테스트는 HTTP 응답을 직접 준비한다. MSW 문서 모드와 섞이지 않게 한다.
  await page.addInitScript(() => localStorage.setItem("devnoteDataSource", "backend"));

  const updatedAt = "2026-11-09T10:00:00";
  const members = [
    { memberId: 1, loginId: "admin", email: "admin@example.com", memberName: "관리자", memberRole: "SUPER_ADMIN", gradeCode: "DIAMOND", accountStatus: "ACTIVE", useYn: "Y", lastLoginAt: null, createdAt: "2026-01-01T00:00:00", updatedAt },
    { memberId: 2, loginId: "kim", email: "kim@example.com", memberName: "김회원", memberRole: "USER", gradeCode: "BRONZE", accountStatus: "ACTIVE", useYn: "Y", lastLoginAt: null, createdAt: "2026-02-01T00:00:00", updatedAt },
  ];
  const session = { authenticated: true, memberId: 1, loginId: "admin", memberName: "관리자", email: "admin@example.com", grade: "DIAMOND", role: "SUPER_ADMIN", administrator: true, superAdministrator: true };
  let passwordChanged = false;
  await page.route("**/api/v1/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    let data: unknown = null;
    if (pathname === "/api/v1/auth/session") data = session;
    else if (pathname === "/api/v1/admin/members" && method === "GET") data = members;
    else if (pathname === "/api/v1/admin/members/2" && method === "GET") data = members[1];
    else if (pathname === "/api/v1/admin/members/2/profile" && method === "PUT") {
      const request = route.request().postDataJSON() as { memberName: string; email: string };
      const target = members.find((member) => member.memberId === 2);
      if (!target) throw new Error("테스트 회원을 찾을 수 없습니다.");
      Object.assign(target, request, { updatedAt: "2026-11-09T10:01:00" });
      data = target;
    } else if (pathname === "/api/v1/account" && method === "GET") data = members[0];
    else if (pathname === "/api/v1/account/password" && method === "PUT") {
      const request = route.request().postDataJSON() as { currentPassword: string; newPassword: string };
      passwordChanged = request.currentPassword === "current-password" && request.newPassword === "new-password";
    } else if (pathname === "/api/v1/portfolio/sections") data = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, code: "SUCCESS", message: "성공", data }) });
  });

  await page.goto("/admin/members");
  await expect(page.getByText("전체 회원 2명")).toBeVisible();
  await expect(page.getByRole("link", { name: "김회원" })).toBeVisible();
  await page.getByText("그룹 · 피벗 · 집계 · 차트").click();
  await expect(page.getByRole("img", { name: "그룹별 집계 막대 차트" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("textbox", { name: "회원 검색" }).fill("김회원");
  await expect(page.getByText("현재 목록에 표시된 1건을 분석합니다.", { exact: false })).toBeVisible();
  await page.getByRole("textbox", { name: "회원 검색" }).clear();
  await expect(page.getByText("현재 목록에 표시된 2건을 분석합니다.", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "김회원" }).click();
  await expect(page.getByRole("heading", { name: "회원 상세정보" })).toBeVisible();
  await page.getByRole("textbox", { name: "이름" }).fill("새 회원");
  await page.getByRole("button", { name: "정보 저장" }).click();
  await expect(page.getByRole("heading", { name: "새 회원" })).toBeVisible();

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "내 계정" })).toBeVisible();
  await page.getByLabel("현재 비밀번호").fill("current-password");
  await page.getByLabel("새 비밀번호", { exact: true }).fill("new-password");
  await page.getByLabel("새 비밀번호 확인").fill("new-password");
  await page.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(page.getByLabel("현재 비밀번호")).toHaveValue("");
  expect(passwordChanged).toBe(true);
});
