import { test, expect } from "./fixtures";

test("TODO 화면 없이 서비스 워커가 여러 푸시의 알림 표시 API를 호출한다", async ({ page, context }) => {
  // 브라우저의 push 이벤트를 CDP로 전달한다. 외부 푸시 서비스·실제 휴대폰 수신은 별도 검증이다.
  await context.grantPermissions(["notifications"]);
  await page.route("**/push-test.html", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><html lang='ko'><title>웹 푸시 검증</title><body>웹 푸시 검증</body></html>" }));
  await page.goto("/push-test.html");
  const origin = new URL(page.url()).origin;
  const protocol = await context.newCDPSession(page);
  let registrationId = "";
  protocol.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
    const registration = registrations.find((entry) => entry.scopeURL === `${origin}/react/boards/todo`);
    if (registration) registrationId = registration.registrationId;
  });
  await protocol.send("ServiceWorker.enable");
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/todo-push-sw.js", { scope: "/react/boards/todo" });
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) throw new Error("서비스 워커가 없습니다.");
    if (worker.state !== "activated") await new Promise<void>((resolve) => {
      const changed = () => { if (worker.state === "activated") { worker.removeEventListener("statechange", changed); resolve(); } };
      worker.addEventListener("statechange", changed); changed();
    });
  });
  await expect.poll(() => registrationId).not.toBe("");
  const worker = context.serviceWorkers().find((entry) => entry.url().endsWith("/todo-push-sw.js"));
  if (!worker) throw new Error("TODO 서비스 워커가 없습니다.");
  const requests = await worker.evaluateHandle(() => {
    if (!("registration" in self) || !(self.registration instanceof ServiceWorkerRegistration)) throw new Error("서비스 워커 등록 정보가 없습니다.");
    const registration = self.registration;
    const displayed: { title: string; body?: string }[] = [];
    const original = registration.showNotification.bind(registration);
    registration.showNotification = (title, options) => { displayed.push({ title, body: options?.body }); return original(title, options); };
    return displayed;
  });
  await page.goto("about:blank");
  await protocol.send("ServiceWorker.deliverPushMessage", { origin, registrationId, data: "" });
  await expect.poll(async () => (await requests.jsonValue()).length).toBe(1);
  expect(await requests.jsonValue()).toEqual([{ title: "TODO 알림", body: "예약한 할 일이 있습니다. 내 TODO 목록에서 확인해 주세요." }]);
  await protocol.send("ServiceWorker.deliverPushMessage", { origin, registrationId, data: "" });
  await expect.poll(async () => (await requests.jsonValue()).length).toBe(2);
  await protocol.detach();
});
