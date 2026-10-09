/**
 * stageSandboxStore.ts — 사이트 안 편집기의 "펼친 단계"와 "색 테마"를 공유하는 작은 저장소
 *
 * 제목 옆 "직접 해 보기" 메뉴(OnlinePracticeMenu)와 연습 화면 맨 아래 편집기 영역(StageSandboxSection)은
 * 화면에서 멀리 떨어진 컴포넌트라 props로 이어 주기 어렵다. 그래서 둘이 같은 값을 보는 전역 저장소를 쓴다.
 *
 * 펼쳐진 단계를 guideId로 기억하므로, 다른 단계 화면으로 이동하면 그 화면에서는 자동으로 접혀 보인다.
 * (새로고침하면 접힌 상태로 시작한다. 편집기는 무거워서 일부러 저장하지 않는다)
 *
 * 색 테마는 단계마다 다시 고르지 않도록 localStorage에 저장한다.
 */
import { create } from "zustand";
import { isSandboxThemeChoice, type SandboxThemeChoice } from "@/features/curriculum/sandbox/sandboxThemes";

const THEME_STORAGE_KEY = "stageSandboxTheme";

/** 저장된 테마를 읽는다. 누구나 개발자 도구로 바꿀 수 있는 값이라 아는 값일 때만 쓰고, 아니면 사이트 테마를 따른다. */
const readSavedTheme = (): SandboxThemeChoice => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return isSandboxThemeChoice(savedTheme) ? savedTheme : "site";
};

interface StageSandboxState {
  expandedGuideId: string | null;
  themeChoice: SandboxThemeChoice;
  expand: (guideId: string) => void;
  toggle: (guideId: string) => void;
  setThemeChoice: (themeChoice: SandboxThemeChoice) => void;
}

export const useStageSandboxStore = create<StageSandboxState>()((set) => ({
  expandedGuideId: null,
  themeChoice: readSavedTheme(),
  expand: (guideId) => set({ expandedGuideId: guideId }),
  toggle: (guideId) => set((state) => ({ expandedGuideId: state.expandedGuideId === guideId ? null : guideId })),
  setThemeChoice: (themeChoice) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeChoice); // 다음 방문·다른 단계에서도 기억
    set({ themeChoice });
  },
}));

/** 편집기 영역의 HTML id. 메뉴에서 펼친 뒤 이 위치로 화면을 옮길 때 쓴다. */
export const STAGE_SANDBOX_SECTION_ID = "stage-sandbox-section";
