/**
 * ============================================================================
 * main.tsx — 이 앱이 "가장 먼저" 실행되는 파일 (진입점 / entry point)
 * ============================================================================
 *
 * [브라우저가 화면을 그리기까지의 순서]
 *   1) 브라우저가 `index.html`을 읽는다.
 *      그 안에는 `<div id="root"></div>` 라는 텅 빈 상자 하나만 들어 있다.
 *   2) `index.html`이 이 `main.tsx`를 불러온다. (Vite가 연결해 준다)
 *   3) 이 파일이 React에게 "이 빈 상자 안에 <App />을 그려라" 하고 시킨다.
 *   4) 그때부터 화면의 모든 것은 React가 관리한다.
 *
 * [왕초보 포인트]
 *   - React 앱에서 `ReactDOM.createRoot(...).render(...)`를 호출하는 곳은
 *     보통 프로젝트 전체에 딱 한 군데뿐이다. 그게 바로 여기다.
 *   - 그래서 "앱이 켜질 때 딱 한 번만 해야 하는 준비 작업"도 여기에 모아 둔다.
 *     (이 프로젝트에서는 가짜 서버(MSW) 켜기, 시작 로그 찍기가 그 준비 작업이다)
 */

import React from "react";
// ReactDOM: React가 만든 화면을 "실제 브라우저 DOM"에 붙여 주는 담당자.
// React 본체(React)와 브라우저에 붙이는 담당자(ReactDOM)는 서로 다른 패키지다.
import ReactDOM from "react-dom/client";
import { App } from "./App";
// MSW(Mock Service Worker): 백엔드 서버 없이도 API가 있는 것처럼 흉내 내주는 도구.
// 백엔드를 안 켜고 프론트만 연습할 때 쓴다.
import { startMockServerWhenEnabled } from "@/mocks/startMockServerWhenEnabled";
import { getSelectedDataSource } from "@/shared/config/dataSourceSelection";
// CSS는 이렇게 import만 해두면 Vite가 알아서 페이지에 넣어 준다.
// 변수로 받아 쓰는 게 아니라 "이 파일도 같이 포함시켜라"라는 뜻이다.
import "./styles/global.css";
import "./styles/advancedUtilities.css";

/**
 * 앱을 시작하는 함수.
 *
 * `async`가 붙은 이유: 아래에서 `await`를 쓰기 때문이다.
 * 가짜 서버(MSW)를 켜는 작업은 시간이 걸리는 비동기 작업이라,
 * "다 켜질 때까지 기다렸다가" 화면을 그려야 첫 요청부터 가짜 서버가 받아 준다.
 *
 * `Promise<void>`: "언젠가 끝나지만, 끝날 때 돌려주는 값은 없다"는 뜻의 타입.
 */
const startApplication = async (): Promise<void> => {
  // await = "이 작업이 끝날 때까지 여기서 잠깐 멈춘다".
  // 만약 await 없이 그냥 호출하면, 가짜 서버가 준비되기 전에
  // 화면이 먼저 그려져서 첫 API 요청이 실패할 수 있다.
  await startMockServerWhenEnabled();

  // 개발자 도구(F12) 콘솔에 현재 실행 설정을 남겨 둔다.
  // "지금 진짜 서버를 보고 있나, 가짜 서버를 보고 있나?"를 바로 확인할 수 있어 디버깅에 유용하다.
  console.info("[Application] React 애플리케이션 시작", {
    strictMode: true,
    // import.meta.env: Vite가 제공하는 환경변수 저장소. `.env` 파일의 값이 여기 담긴다.
    httpClient: import.meta.env.VITE_HTTP_CLIENT,
    dataSource: getSelectedDataSource(),
  });

  // index.html 안에 있는 <div id="root"></div>를 찾아온다.
  const rootElement = document.getElementById("root");
  // TypeScript 기준으로 getElementById는 "없을 수도 있음(null)"을 돌려준다.
  // 그래서 반드시 없는 경우를 먼저 걸러 줘야 아래에서 안심하고 쓸 수 있다.
  if (!rootElement) {
    throw new Error("root 요소를 찾을 수 없습니다.");
  }

  // createRoot(...)로 React가 관리할 영역을 만들고, render(...)로 그 안에 그린다.
  ReactDOM.createRoot(rootElement).render(
    // <React.StrictMode>: 개발 모드 전용 "안전 검사기".
    // 컴포넌트를 일부러 두 번 실행해서, 실수로 넣은 부작용(side effect)이나
    // 정리(cleanup)를 빠뜨린 useEffect를 찾아 준다.
    //
    // ★ 왕초보가 가장 많이 놀라는 지점:
    //   "왜 console.log가 두 번 찍히지?" → StrictMode 때문이다. 버그가 아니다.
    //   실제 배포(build) 결과물에서는 한 번만 실행된다.
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

// `void`를 앞에 붙인 이유:
// startApplication()은 Promise를 돌려주는데, 여기서는 그 결과를 기다리지도 쓰지도 않는다.
// 그냥 호출하면 린트 도구가 "Promise를 무시했다"고 경고하므로,
// `void`로 "결과를 안 쓰는 게 의도한 것"임을 분명히 표시한다.
void startApplication();
