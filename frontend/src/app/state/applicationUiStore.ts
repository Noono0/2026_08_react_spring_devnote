/**
 * ============================================================================
 * applicationUiStore.ts — 앱 전체가 공유하는 UI 상태 저장소 (Zustand)
 * ============================================================================
 *
 * [언제 전역 상태가 필요한가?]
 *   useState는 "그 컴포넌트 안에서만" 쓰는 값에 적합하다.
 *   그런데 다음 두 조건에 해당하면 useState로는 불편해진다.
 *     - 서로 멀리 떨어진 컴포넌트들이 같은 값을 봐야 한다
 *     - 값을 바꾸는 곳과 값을 쓰는 곳이 다르다
 *
 *   예: 다크모드 토글 버튼은 상단 헤더에 있는데,
 *       그 결과는 화면 전체와 알림 팝업 색깔까지 바뀌어야 한다.
 *       공통 부모까지 값을 끌어올려 props로 내려보내는 건 너무 번거롭다.
 *       → 그래서 전역 스토어를 쓴다.
 *
 * [Zustand를 쓰는 이유]
 *   React 기본 Context API보다 코드가 짧고, 필요한 값만 골라 구독할 수 있어서
 *   불필요한 리렌더링이 적다. Redux보다 배우기 쉽다.
 *
 * [여기서 관리하는 값]
 *   - applicationTheme    : 라이트/다크 테마
 *   - isSidebarCollapsed  : 사이드바 접힘 여부 (PC)
 *   - isMobileSidebarOpen : 사이드바 열림 여부 (모바일 오버레이)
 *
 * ★ 주의: 서버에서 받아온 데이터(문서 목록 등)는 여기 넣지 않는다.
 *   그건 TanStack Query가 담당한다. "UI 상태"와 "서버 상태"는 분리하는 게 원칙이다.
 */

import { create } from "zustand";

// 유니온 타입: 이 변수에는 "light" 또는 "dark" 딱 두 문자열만 넣을 수 있다.
// 그냥 string으로 두면 "lgiht" 같은 오타를 TypeScript가 못 잡아 준다.
export type ApplicationTheme = "light" | "dark";

/**
 * 스토어의 설계도(타입).
 * 위쪽 3개는 "값", 아래쪽 5개는 "값을 바꾸는 함수"다.
 * Zustand는 값과 함수를 한 객체 안에 같이 담는 스타일이다.
 */
interface ApplicationUiState {
  applicationTheme: ApplicationTheme;
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  setApplicationTheme: (applicationTheme: ApplicationTheme) => void;
  toggleApplicationTheme: () => void;
  toggleSidebarCollapsed: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

/**
 * 앱을 켤 때 처음 보여줄 테마를 정한다. 우선순위는 이렇다.
 *   1순위: 사용자가 예전에 직접 고른 값 (localStorage에 저장돼 있음)
 *   2순위: 운영체제/브라우저의 다크모드 설정
 *   3순위: 그래도 모르겠으면 라이트 모드
 *
 * localStorage: 브라우저에 문자열을 저장해 두는 공간.
 * 새로고침하거나 브라우저를 껐다 켜도 남아 있다. (React State는 새로고침하면 사라진다)
 */
const getInitialApplicationTheme = (): ApplicationTheme => {
  const savedTheme = localStorage.getItem("applicationTheme");

  // ★ 왜 굳이 값을 검사하나?
  //   localStorage는 누구나 개발자 도구로 열어서 아무 값이나 넣을 수 있다.
  //   저장된 게 "바나나"일 수도 있다. 그대로 믿고 쓰면 화면이 깨진다.
  //   그래서 "우리가 아는 값이 맞는지" 확인하고 통과한 것만 쓴다.
  //   이렇게 검사하면 TypeScript도 savedTheme을 ApplicationTheme 타입으로 좁혀서 인정해 준다.
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  // matchMedia: CSS의 미디어 쿼리를 JavaScript에서 물어보는 함수.
  // "(prefers-color-scheme: dark)" = "이 사용자는 OS에서 다크모드를 켜 뒀나요?"
  //
  // `typeof window.matchMedia === "function"` 으로 먼저 확인하는 이유:
  // 테스트 환경(jsdom)이나 아주 오래된 브라우저에는 이 함수가 없어서
  // 바로 호출하면 앱 전체가 에러로 죽는다. 있는지 확인하고 쓰는 게 안전하다.
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * 정해진 테마를 실제 HTML에 반영한다.
 *
 * React가 아니라 DOM을 직접 건드리는 이유:
 * <html> 태그는 React가 그리는 영역(#root) 바깥에 있어서 JSX로 손댈 수 없다.
 * 이렇게 최상위 태그에 표시를 남기면, CSS에서
 *   [data-theme="dark"] { --배경색: 검정; }
 * 처럼 한 방에 전체 색을 갈아끼울 수 있다.
 */
const applyApplicationTheme = (applicationTheme: ApplicationTheme): void => {
  // dataset.theme = "dark"  →  <html data-theme="dark">  가 된다.
  document.documentElement.dataset.theme = applicationTheme;
  // colorScheme: 브라우저 기본 UI(스크롤바, input 기본 배경 등)도 같이 어둡게 만든다.
  // 이걸 빼먹으면 배경만 검고 스크롤바는 하얘서 어색해진다.
  document.documentElement.style.colorScheme = applicationTheme;
};

// ★ 이 두 줄은 컴포넌트 밖, 파일이 로드되는 순간 딱 한 번 실행된다.
//   React가 첫 화면을 그리기도 전에 테마를 미리 입혀 두기 위해서다.
//   이걸 useEffect 안에서 하면 "흰 화면이 번쩍 보였다가 검게 바뀌는" 깜빡임이 생긴다.
const initialApplicationTheme = getInitialApplicationTheme();
applyApplicationTheme(initialApplicationTheme);

/**
 * 실제 스토어를 만든다.
 *
 * `create<타입>((set, get) => ({ ... }))` 형태로 쓴다.
 *   set : 상태를 바꾸는 함수. 넘긴 객체가 기존 상태에 "합쳐진다"(덮어쓰기 아님).
 *   get : 지금 상태를 읽는 함수. 이전 값을 알아야 계산할 수 있을 때 쓴다.
 *
 * 결과물 이름이 `useApplicationUiStore`처럼 `use`로 시작하는 이유:
 * 이건 React 훅이고, 훅 이름은 반드시 use로 시작해야 한다는 규칙(Rules of Hooks)이 있다.
 */
export const useApplicationUiStore = create<ApplicationUiState>((set, get) => ({
  // ── 초기값 ──────────────────────────────────────────────
  applicationTheme: initialApplicationTheme,
  // localStorage에는 무조건 문자열만 저장된다. boolean true를 넣어도 "true"로 저장된다.
  // 그래서 꺼낼 때도 문자열 "true"와 비교해서 boolean으로 되돌려야 한다.
  isSidebarCollapsed: localStorage.getItem("isSidebarCollapsed") === "true",
  // 모바일 메뉴는 저장하지 않는다. 새로고침하면 항상 닫힌 상태로 시작하는 게 자연스럽다.
  isMobileSidebarOpen: false,

  // ── 상태를 바꾸는 함수들 ────────────────────────────────

  /** 테마를 특정 값으로 직접 지정한다. */
  setApplicationTheme: (applicationTheme) => {
    // 순서에 주의: 저장 → DOM 반영 → React 상태 갱신
    localStorage.setItem("applicationTheme", applicationTheme); // 다음 방문 때도 기억하도록
    applyApplicationTheme(applicationTheme);                    // <html> 태그에 즉시 반영
    set({ applicationTheme });                                  // 구독 중인 컴포넌트들 다시 그리기
  },

  /** 테마를 반대로 뒤집는다 (라이트 ↔ 다크). */
  toggleApplicationTheme: () => {
    // get()으로 "지금" 값을 읽는다.
    // ★ 여기서 바깥 변수 initialApplicationTheme을 쓰면 안 된다.
    //   그건 앱 시작 시점의 옛날 값이라, 두 번째 토글부터 엉뚱하게 동작한다.
    //   이런 실수를 "오래된 값을 붙잡고 있다(stale closure)"고 부른다.
    const nextApplicationTheme = get().applicationTheme === "dark" ? "light" : "dark";
    localStorage.setItem("applicationTheme", nextApplicationTheme);
    applyApplicationTheme(nextApplicationTheme);
    set({ applicationTheme: nextApplicationTheme });
  },

  /** 사이드바 접기/펼치기를 뒤집고, 그 선택을 기억한다. */
  toggleSidebarCollapsed: () => {
    const nextSidebarCollapsed = !get().isSidebarCollapsed;
    // String(...)으로 감싸는 이유: localStorage는 문자열만 받는다.
    // boolean을 그냥 넣으면 TypeScript가 타입 에러를 낸다.
    localStorage.setItem("isSidebarCollapsed", String(nextSidebarCollapsed));
    set({ isSidebarCollapsed: nextSidebarCollapsed });
  },

  // 이전 값이 필요 없는 단순 설정이라 get() 없이 set()만 쓴다.
  // 화살표 함수에서 `() => set({...})`는 set의 결과를 그대로 return한다는 뜻이지만,
  // 여기서는 반환값을 아무도 안 쓰므로 문제없다.
  openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
}));
