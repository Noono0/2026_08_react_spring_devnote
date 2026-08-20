/**
 * ============================================================================
 * startMockServerWhenEnabled.ts — 가짜 서버(MSW)를 켜고 끄는 스위치
 * ============================================================================
 *
 * ★ main.tsx가 앱을 시작하며 가장 먼저 부르는 함수가 바로 이것이다.
 *   화면을 그리기 전에 실행되어야 하므로 순서가 매우 중요하다.
 *
 * [MSW(Mock Service Worker)가 뭔가요?]
 *   백엔드 서버 없이도 API가 있는 것처럼 흉내 내주는 도구다.
 *
 *   ★ 다른 가짜 데이터 방식과 결정적으로 다른 점:
 *     보통은 코드에 `if (개발중) return 가짜데이터;` 같은 분기를 넣는다.
 *     그러면 화면 코드가 "지금 가짜인지 진짜인지"를 알아야 하고,
 *     배포할 때 그 분기를 지우다가 실수하기도 한다.
 *
 *     MSW는 브라우저의 **서비스 워커**를 써서 네트워크 요청 자체를 가로챈다.
 *     즉 axios나 fetch는 평소처럼 요청을 보내고, 그게 나가기 직전에
 *     MSW가 낚아채서 미리 만들어 둔 답을 돌려준다.
 *     ★ 그래서 앱 코드는 한 줄도 안 고쳐도 되고, 진짜인지 가짜인지 전혀 모른다.
 *     개발자도구 Network 탭에도 진짜 요청처럼 보인다.
 *
 * [서비스 워커란?]
 *   브라우저가 페이지와 별개로 백그라운드에서 돌리는 작은 프로그램이다.
 *   네트워크 요청을 중간에서 가로챌 수 있는 권한을 갖는다.
 *   원래는 오프라인 지원(PWA)을 위해 만들어진 기능인데, MSW가 그걸 활용한 것이다.
 *
 * [이 파일이 하는 일 두 가지]
 *   1. 데이터 소스가 "mock"이면 → 가짜 서버를 켠다
 *   2. "backend"면 → 혹시 예전에 켜 둔 가짜 서버를 확실히 끈다  ← 이게 더 중요!
 */

import { getSelectedDataSource } from "@/shared/config/dataSourceSelection";
import { applicationLogger } from "@/shared/logging/applicationLogger";

/**
 * ★★ 예전에 등록된 MSW 서비스 워커를 지운다.
 *
 * [왜 이 함수가 꼭 필요한가 — 이게 없으면 생기는 악몽 같은 버그]
 *   서비스 워커는 한 번 등록되면 페이지를 새로고침해도, 탭을 닫았다 열어도,
 *   심지어 코드에서 MSW를 꺼도 브라우저에 계속 살아 있다.
 *
 *   그래서 이런 일이 벌어진다:
 *     1) 가짜 서버 모드로 개발한다 → 서비스 워커 등록됨
 *     2) 진짜 백엔드 모드로 바꾼다
 *     3) 그런데 요청이 여전히 가짜 데이터를 돌려준다!
 *     4) 백엔드 개발자는 "요청이 안 들어온다"고 하고,
 *        프론트 개발자는 "보내고 있는데요?"라고 한다
 *   원인을 찾기가 정말 어렵다. 그래서 진짜 서버 모드일 때 확실히 지워 준다.
 */
const unregisterMockServiceWorker = async (): Promise<void> => {
  // 서비스 워커를 지원하지 않는 환경(구형 브라우저, 테스트 환경)이면 그냥 나간다.
  // `"키" in 객체` 는 그 속성이 있는지 확인하는 문법이다.
  if (!("serviceWorker" in navigator)) {
    return;
  }

  // 현재 이 사이트에 등록된 서비스 워커를 전부 가져온다.
  const serviceWorkerRegistrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    serviceWorkerRegistrations
      .filter((serviceWorkerRegistration) => {
        // ★ 서비스 워커는 생애 주기에 따라 세 자리 중 하나에 들어 있다.
        //     active     : 지금 동작 중
        //     waiting    : 새 버전이 대기 중
        //     installing : 설치 중
        //   어느 자리에 있을지 모르므로 `??`로 순서대로 확인한다.
        const serviceWorkerScriptUrl =
          serviceWorkerRegistration.active?.scriptURL
          ?? serviceWorkerRegistration.waiting?.scriptURL
          ?? serviceWorkerRegistration.installing?.scriptURL;

        // ★ MSW가 만든 것만 골라 지운다. 이 조건이 매우 중요하다.
        //   전부 지우면 나중에 이 사이트에 다른 서비스 워커(푸시 알림, 오프라인 캐시 등)를
        //   붙였을 때 그것까지 날려 버린다.
        //   `?? false` 는 주소를 못 찾았을 때 "우리 것이 아니다"로 처리한다는 뜻이다.
        return serviceWorkerScriptUrl?.includes("mockServiceWorker.js") ?? false;
      })
      // 해당하는 것들을 지우는 Promise 배열을 만든다.
      .map((serviceWorkerRegistration) => serviceWorkerRegistration.unregister()),
  );
  // Promise.all로 전부 지워질 때까지 기다린다.
  // 하나씩 await하는 것보다 동시에 처리해서 빠르다.
};

/**
 * 설정에 따라 가짜 서버를 켜거나 확실히 끈다.
 *
 * ★ main.tsx에서 `await`로 이 함수를 기다린 뒤에 화면을 그리는 이유:
 *   기다리지 않으면 가짜 서버가 준비되기 전에 첫 API 요청이 나가서
 *   그 요청만 실패한다. 화면이 뜨자마자 오류가 뜨는 이상한 상황이 된다.
 */
export const startMockServerWhenEnabled = async (): Promise<void> => {
  const selectedDataSource = getSelectedDataSource();

  // ── 진짜 백엔드를 쓰는 경우 ──
  if (selectedDataSource !== "mock") {
    // 남아 있을지 모르는 가짜 서버를 확실히 정리한다.
    await unregisterMockServiceWorker();
    applicationLogger.info("[MSW] 더미 데이터 OFF - 실제 Spring Boot API를 사용합니다.");
    return;
  }

  // ── 가짜 서버를 쓰는 경우 ──
  //
  // ★★ 여기서 `await import(...)`로 "동적 import"를 쓴 것이 핵심이다.
  //   파일 맨 위에서 일반 import로 가져오면, 진짜 백엔드를 쓸 때도
  //   MSW 라이브러리와 모든 가짜 데이터가 배포 결과물에 포함된다.
  //   실제로는 쓰지도 않는 코드 수백 KB가 사용자에게 전송되는 것이다.
  //
  //   동적 import를 쓰면 이 줄에 도달했을 때만 파일을 내려받는다.
  //   진짜 서버 모드에서는 위 return으로 빠져나가므로 아예 다운로드되지 않는다.
  //   (App.tsx의 lazy()와 완전히 같은 원리다)
  const { setupWorker } = await import("msw/browser");
  const { requestHandlers } = await import("./requestHandlers");

  // `...requestHandlers` — 배열을 펼쳐서 개별 인자로 넘긴다.
  // setupWorker(handler1, handler2, ...) 형태를 요구하기 때문이다.
  const mockServer = setupWorker(...requestHandlers);

  // ★ onUnhandledRequest: "bypass" 옵션이 중요하다.
  //   우리가 정의하지 않은 요청(이미지, 폰트, Vite 개발 서버 요청 등)을
  //   가로채지 않고 그냥 통과시킨다는 뜻이다.
  //
  //   기본값은 "warn"이라 콘솔에 경고가 쏟아진다.
  //   "error"로 두면 정의 안 한 요청이 전부 실패해서 화면이 깨진다.
  //   학습용으로는 "필요한 것만 흉내 내고 나머지는 그대로"가 편하다.
  await mockServer.start({ onUnhandledRequest: "bypass" });

  applicationLogger.info("[MSW] 더미 데이터 ON - 더미 API 서버가 시작되었습니다.", {
    // 어떤 시나리오로 동작 중인지 함께 남긴다.
    // localStorage 값이 우선이고, 없으면 .env 기본값을 쓴다.
    scenario: localStorage.getItem("mockScenario") ?? import.meta.env.VITE_MOCK_SCENARIO,
  });
};
