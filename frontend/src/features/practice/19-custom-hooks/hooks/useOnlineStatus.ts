/**
 * useOnlineStatus — 브라우저가 지금 인터넷에 연결되어 있는지 알려 주는 커스텀 훅
 *
 * [useSyncExternalStore란?]
 *   React 바깥에 있는 값(브라우저의 navigator.onLine, 외부 라이브러리 저장소 등)을
 *   React 화면과 안전하게 맞춰 주는 훅이다.
 *     subscribe   → "값이 바뀌면 알려 줘"라고 등록하고, 해제 함수를 돌려준다.
 *     getSnapshot → 지금 값을 읽는다.
 *
 * ❌ useState + useEffect로 직접 만들면
 *   이벤트 등록 전 순간의 변화를 놓치거나, 동시 렌더링에서 화면 일부만 옛 값을 보는 문제가 생길 수 있다.
 * ✓ useSyncExternalStore는 React가 그런 경우까지 책임진다.
 *
 * subscribe를 컴포넌트 바깥에 둔 이유: 렌더링마다 새 함수가 되면 React가 매번 구독을 다시 한다.
 */

import { useSyncExternalStore } from "react";

const subscribeOnlineStatus = (onStoreChange: () => void): (() => void) => {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  // ★ 정리 함수: 컴포넌트가 사라지면 이벤트 등록도 지운다.
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
};

// navigator.onLine: 브라우저가 판단한 현재 연결 상태(true/false). 값이 바뀌면 React가 다시 그린다.
const getOnlineSnapshot = (): boolean => navigator.onLine;

export const useOnlineStatus = (): boolean => useSyncExternalStore(subscribeOnlineStatus, getOnlineSnapshot);
