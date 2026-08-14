import { getSelectedDataSource } from "@/shared/config/dataSourceSelection";
import { applicationLogger } from "@/shared/logging/applicationLogger";

const unregisterMockServiceWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const serviceWorkerRegistrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    serviceWorkerRegistrations
      .filter((serviceWorkerRegistration) => {
        const serviceWorkerScriptUrl =
          serviceWorkerRegistration.active?.scriptURL
          ?? serviceWorkerRegistration.waiting?.scriptURL
          ?? serviceWorkerRegistration.installing?.scriptURL;

        return serviceWorkerScriptUrl?.includes("mockServiceWorker.js") ?? false;
      })
      .map((serviceWorkerRegistration) => serviceWorkerRegistration.unregister()),
  );
};

export const startMockServerWhenEnabled = async (): Promise<void> => {
  const selectedDataSource = getSelectedDataSource();

  if (selectedDataSource !== "mock") {
    await unregisterMockServiceWorker();
    applicationLogger.info("[MSW] 더미 데이터 OFF - 실제 Spring Boot API를 사용합니다.");
    return;
  }

  const { setupWorker } = await import("msw/browser");
  const { requestHandlers } = await import("./requestHandlers");
  const mockServer = setupWorker(...requestHandlers);

  await mockServer.start({ onUnhandledRequest: "bypass" });

  applicationLogger.info("[MSW] 더미 데이터 ON - 더미 API 서버가 시작되었습니다.", {
    scenario: localStorage.getItem("mockScenario") ?? import.meta.env.VITE_MOCK_SCENARIO,
  });
};
