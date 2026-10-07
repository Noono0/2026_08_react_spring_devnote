/**
 * ============================================================================
 * practiceAuthContext.ts — Context로 "로그인한 사람" 정보를 여러 화면이 함께 쓰기
 * ============================================================================
 *
 * [Context가 필요한 순간]
 *   로그인 정보는 상단 메뉴, 마이페이지, 보호된 화면… 여러 곳에서 필요하다.
 *   props로 넘기면 중간 컴포넌트들이 쓰지도 않는 값을 계속 전달해야 한다(prop drilling).
 *   Context는 Provider로 감싼 범위 안이라면 어디서든 바로 꺼내 쓰게 해 준다.
 *
 * [세 조각으로 나눈다]
 *   1. createContext        → 값을 담을 "통로" (이 파일)
 *   2. PracticeAuthProvider → 실제 값(State)을 갖고 통로에 흘려보냄 (PracticeAuthProvider.tsx)
 *   3. usePracticeAuth      → 통로에서 값을 꺼내는 전용 훅 (이 파일)
 *   컴포넌트(Provider)와 훅을 다른 파일에 두면 Vite Fast Refresh가 화면 상태를 유지한 채 고칠 수 있다.
 *
 * [Context vs Zustand vs TanStack Query]
 *   Context        : 특정 화면 묶음 안에서만 공유하는 값 (이 실습의 로그인 정보)
 *   Zustand        : 앱 전체에서 자주 바뀌는 UI 상태 (사이드바 접힘 등)
 *   TanStack Query : 서버에서 받아 오는 데이터 (이 프로젝트의 실제 로그인 세션은 useAuthSession이 담당)
 */

import { createContext, useContext } from "react";

export interface PracticeUser {
  loginId: string;
  displayName: string;
}

export interface PracticeAuthContextValue {
  user: PracticeUser | null;
  login: (loginId: string, password: string) => boolean;
  logout: () => void;
}

/** 실습용 비밀번호. 실제 서비스라면 절대 화면 코드에 비밀번호를 적지 않는다. */
export const PRACTICE_PASSWORD = "react1234";

// 기본값 null: Provider 밖에서 꺼내면 null이 나와 usePracticeAuth가 실수를 알려 줄 수 있다.
export const PracticeAuthContext = createContext<PracticeAuthContextValue | null>(null);

export const usePracticeAuth = (): PracticeAuthContextValue => {
  const context = useContext(PracticeAuthContext);
  // ★ Provider로 감싸는 것을 잊으면 null이 나온다. 조용히 넘어가지 않고 원인을 바로 알려 준다.
  if (!context) throw new Error("usePracticeAuth는 PracticeAuthProvider 안에서만 사용할 수 있습니다.");
  return context;
};
