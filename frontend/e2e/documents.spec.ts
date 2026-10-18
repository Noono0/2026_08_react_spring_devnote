/**
 * ============================================================================
 * documents.spec.ts — 14단계 문서 CRUD를 MSW(가짜 서버)와 함께 검사
 * ============================================================================
 *
 * 이 테스트가 확인하는 흐름:
 *   브라우저 → axios 요청 → 서비스 워커(MSW)가 가로챔 → requestHandlers.ts가 응답
 *   → TanStack Query 캐시 → 화면
 *
 * jsdom 기반 Vitest에서는 서비스 워커가 동작하지 않아 이 연결 전체를 한 번에 볼 수 없다.
 * 실제 브라우저에서만 확인할 수 있는 부분이라 E2E로 검사한다.
 *
 * [가짜 데이터 기준] src/mocks/documentMockData.ts가 "React 연습 문서 1" ~ "57"을 만든다.
 *   한 페이지는 10개다. 테스트의 숫자는 이 데이터에서 나온 값이다.
 *
 * ★ 가짜 서버의 "DB"는 페이지의 메모리에 있다(requestHandlers.ts의 mockDocumentStore).
 *   page.goto나 reload로 페이지를 새로 열면 57건 처음 상태로 돌아간다.
 *   그래서 저장한 결과를 확인할 때는 주소를 새로 열지 말고 화면 안의 링크로 이동한다.
 *   (테스트마다 새 브라우저 컨텍스트를 쓰므로 한 테스트의 변경이 다른 테스트로 새지도 않는다)
 */

import { expect, test } from "./fixtures";

test.describe("14단계 문서 CRUD (MSW)", () => {
  test("새 문서를 등록하면 상세와 목록에서 보인다", async ({ page }) => {
    await page.goto("/react/documents");
    await page.getByRole("link", { name: "새 문서 작성" }).click();
    await expect(page).toHaveURL("/react/documents/new");

    await page.getByLabel("문서 제목").fill("E2E로 등록한 문서");
    // 라벨 안에 설명 문구(<small>)도 들어 있어 이름이 "태그 쉼표로 구분…"이 된다. 정규식으로 앞부분만 맞춘다.
    await page.getByLabel(/^태그/).fill("E2E, 스모크");
    // Tiptap 에디터는 <input>이 아니라 contenteditable 영역이다. RichTextEditor가 role="textbox"와
    // 이름(aria-label = editorLabel, 기본 "상세 내용")을 붙여 두어 CSS 클래스 대신 역할과 이름으로 찾는다.
    await page.getByRole("textbox", { name: "상세 내용" }).click();
    await page.keyboard.type("E2E 테스트로 작성한 본문입니다.");
    await page.getByRole("button", { name: "문서 등록" }).click();

    // 더미 문서가 57건이므로 새 문서는 58번이 된다. 예전에는 항상 999번이라 여기서 404가 났다.
    await expect(page).toHaveURL("/react/documents/58");
    await expect(page.getByRole("heading", { name: "E2E로 등록한 문서" })).toBeVisible();
    await expect(page.getByText("E2E 테스트로 작성한 본문입니다.")).toBeVisible();

    // 상세의 태그 링크로 목록에 이동한다(페이지를 새로 열지 않으므로 가짜 서버의 메모리가 유지된다).
    await page.getByRole("link", { name: "#E2E" }).click();
    await expect(page).toHaveURL(/\/react\/documents\?tag=E2E/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "E2E로 등록한 문서" })).toBeVisible();
  });

  test("목록 조회·검색·보기 방식 전환", async ({ page }) => {
    await page.goto("/react/documents");

    // 표의 몸통(tbody) 행만 센다. 머리글 행까지 세면 11개가 된다.
    const documentRows = page.locator("tbody tr");
    await expect(documentRows).toHaveCount(10);
    await expect(page.getByRole("link", { name: "React 연습 문서 1", exact: true })).toBeVisible();

    // "React 연습 문서 5"를 검색하면 5, 50~57번 → 9건이 남는다.
    await page.getByLabel("검색어").fill("React 연습 문서 5");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(documentRows).toHaveCount(9);
    // 검색 조건은 URL에 저장된다. 새로고침·공유해도 같은 결과가 나와야 한다.
    await expect(page).toHaveURL(/searchKeyword=/);

    // 보기 방식도 URL에 저장된다.
    await page.getByRole("button", { name: "▦ 썸네일" }).click();
    await expect(page).toHaveURL(/viewMode=thumbnail/);
    await expect(documentRows).toHaveCount(0);
  });

  test("상세 조회 후 제목을 수정한다", async ({ page }) => {
    await page.goto("/react/documents");
    await page.getByRole("link", { name: "React 연습 문서 2", exact: true }).click();

    await expect(page).toHaveURL("/react/documents/2");
    await expect(page.getByRole("heading", { name: "React 연습 문서 2" })).toBeVisible();

    // 수정은 주소가 바뀌는 이동이라 <button>이 아니라 <Link>(link 역할)로 만들어져 있다.
    await page.getByRole("link", { name: "수정", exact: true }).click();
    await expect(page).toHaveURL("/react/documents/2/edit");

    const titleInput = page.getByLabel("문서 제목");
    // ★ 수정 화면은 서버 데이터를 받아 폼을 채운다(reset). 채워지기 전에 fill하면
    //   늦게 도착한 원래 값이 입력을 덮어쓴다. 원래 값이 보일 때까지 먼저 기다린다.
    await expect(titleInput).toHaveValue("React 연습 문서 2");
    await titleInput.fill("E2E로 수정한 문서");
    await page.getByRole("button", { name: "수정 저장" }).click();

    // 저장에 성공하면 상세 화면으로 돌아가고, 수정 응답으로 채운 캐시가 바로 보인다.
    await expect(page).toHaveURL("/react/documents/2");
    await expect(page.getByRole("heading", { name: "E2E로 수정한 문서" })).toBeVisible();
  });

  test("확인창을 수락하면 삭제 후 목록으로 이동한다", async ({ page }) => {
    await page.goto("/react/documents/3");
    await expect(page.getByRole("heading", { name: "React 연습 문서 3" })).toBeVisible();

    // window.confirm 같은 브라우저 기본 대화상자는 Playwright가 기본으로 "취소"한다.
    // 클릭하기 "전에" 수락하도록 등록해야 한다. 클릭 뒤에 등록하면 이미 취소된 뒤다.
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("문서를 삭제하시겠습니까?");
      void dialog.accept();
    });
    await page.getByRole("button", { name: "삭제" }).click();

    await expect(page).toHaveURL("/react/documents");
    await expect(page.getByText("문서를 삭제했습니다.")).toBeVisible();
    // 가짜 서버가 실제로 지웠으므로 다시 받아 온 목록에도 3번이 없어야 한다.
    await expect(page.getByRole("link", { name: "React 연습 문서 2", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "React 연습 문서 3", exact: true })).toBeHidden();
  });
});
