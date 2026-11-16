/* TODO 푸시만 처리한다. 페이지·API를 캐시하지 않는다. / Push only, without page or API caching. */
self.addEventListener("install", (event) => { event.waitUntil(self.skipWaiting()); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("push", (event) => {
  event.waitUntil(self.registration.showNotification("TODO 알림", {
    body: "예약한 할 일이 있습니다. 내 TODO 목록에서 확인해 주세요.",
    icon: "/todo-app-icon.svg", data: { url: "/react/boards/todo" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL("/react/boards/todo", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url === destination && "focus" in client) { await client.focus(); return; }
    }
    await self.clients.openWindow(destination);
  })());
});
