/**
 * ============================================================================
 * playwright.config.ts — 브라우저 E2E(End-to-End) 스모크 테스트 설정
 * ============================================================================
 *
 * [Vitest 테스트와 무엇이 다른가?]
 *   - Vitest + Testing Library: jsdom이라는 "가짜 브라우저"에서 컴포넌트 하나를 그려 본다.
 *     빠르지만 라우터·지연 로딩(lazy)·서비스 워커(MSW)·CSS 같은 실제 브라우저 동작은 확인하지 못한다.
 *   - Playwright: 진짜 Chromium을 띄워 사용자가 하듯 주소를 열고, 클릭하고, 글자를 친다.
 *     느린 대신 "앱 전체가 실제로 켜지고 화면이 이어지는지"를 확인한다.
 *
 * [스모크(smoke) 테스트란?]
 *   전기 제품에 처음 전원을 넣었을 때 "연기가 나는지"만 보는 것에서 온 말이다.
 *   모든 경우를 다 검사하지 않고, 핵심 화면 몇 개가 열리고 기본 동작이 되는지만 빠르게 본다.
 *   세부 규칙은 이미 Vitest가 검사하므로 E2E는 적게, 굵직하게 유지한다.
 *
 * [백엔드 없이 도는 이유]
 *   테스트 서버를 `vite --mode online`으로 켠다. `.env.online`이 VITE_DATA_SOURCE=mock이라
 *   MSW(가짜 서버)가 문서 API를 대신 응답한다. 그래서 Java·MySQL·Docker 없이 CI에서 바로 돈다.
 *   ★ 반대로 말하면, 여기서 통과해도 실제 Spring Boot API와의 연결까지 검증한 것은 아니다.
 *
 * 실행: frontend 폴더에서 `pnpm run e2e` (처음 한 번은 `pnpm exec playwright install chromium`)
 */

import { defineConfig, devices } from "@playwright/test";

// 평소 개발 서버(5173)와 겹치지 않도록 E2E 전용 포트를 따로 쓴다.
// 같은 포트를 쓰면 개발 중인 서버(실제 백엔드 모드)에 테스트가 붙어 엉뚱한 결과가 나온다.
// ★ 5174도 피한다. 5173이 이미 쓰이고 있으면 Vite가 다음 개발 서버를 자동으로 5174에 켜기 때문이다.
const E2E_PORT = 5191;
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

// CI 환경변수: GitHub Actions는 CI=true를 자동으로 넣어 준다.
const isContinuousIntegration = Boolean(process.env.CI);

export default defineConfig({
  // E2E 테스트 파일은 src 밖 e2e 폴더에 둔다. (Vitest는 src 안만 검사하도록 설정되어 있다)
  testDir: "./e2e",
  // 한 테스트가 30초 넘게 걸리면 실패로 본다. 첫 실행 때 Vite가 모듈을 변환하느라 조금 느릴 수 있다.
  timeout: 30_000,
  // 각 파일의 테스트를 병렬로 실행한다. 테스트끼리 상태를 공유하지 않게 짜야 가능한 설정이다.
  fullyParallel: true,
  // ★ CI에서 실수로 남긴 test.only가 있으면 실패시킨다.
  //   남겨 두면 그 테스트 하나만 돌고 나머지가 조용히 건너뛰어져 "통과"로 보이기 때문이다.
  forbidOnly: isContinuousIntegration,
  // 네트워크·속도 때문에 가끔 흔들리는 실패를 CI에서만 한 번 더 시도한다.
  // 로컬에서는 재시도하지 않아야 흔들리는 테스트를 바로 알아챌 수 있다.
  retries: isContinuousIntegration ? 1 : 0,
  // CI 러너는 CPU가 적어 작업자를 1개로 고정한다. 로컬은 Playwright 기본값(CPU 수 기준)을 쓴다.
  workers: isContinuousIntegration ? 1 : undefined,
  // CI에서는 실패 화면을 내려받아 볼 수 있도록 HTML 보고서도 만든다(브라우저 자동 열기는 끈다).
  reporter: isContinuousIntegration ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    // 화면 문구가 한국어라 브라우저 언어도 한국어로 맞춘다. (날짜·숫자 형식이 운영 화면과 같아진다)
    locale: "ko-KR",
    // 실패했을 때만 재시도 기록(trace)·스크린샷을 남긴다. 통과한 테스트까지 남기면 느리고 용량이 커진다.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // 스모크 테스트이므로 Chromium 하나만 쓴다. 브라우저를 늘리면 CI 시간과 설치 용량이 그만큼 늘어난다.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // msw init: 가짜 서버가 쓰는 public/mockServiceWorker.js를 만든다(저장소에는 올리지 않는 생성 파일).
    // --strictPort: 포트가 이미 쓰이고 있으면 다른 포트로 바꾸지 말고 실패하게 한다.
    //   바꿔 버리면 Playwright는 계속 같은 주소를 기다리다가 시간 초과로 끝나 원인을 찾기 어렵다.
    command: `pnpm exec msw init public --no-save && pnpm exec vite --mode online --port ${E2E_PORT} --strictPort`,
    url: E2E_BASE_URL,
    // 로컬에서는 이미 켜 둔 E2E 서버를 재사용해 빠르게 반복한다. CI는 항상 새로 켠다.
    reuseExistingServer: !isContinuousIntegration,
    timeout: 120_000,
  },
});
