/**
 * stageSandboxStore.ts — 사이트 안 편집기의 "펼친 단계"·"색 테마"·"크기"를 공유하는 작은 저장소
 *
 * 제목 옆 "직접 해 보기" 메뉴(OnlinePracticeMenu)와 연습 화면 맨 아래 편집기 영역(StageSandboxSection)은
 * 화면에서 멀리 떨어진 컴포넌트라 props로 이어 주기 어렵다. 그래서 둘이 같은 값을 보는 전역 저장소를 쓴다.
 *
 * 펼쳐진 단계를 guideId로 기억하므로, 다른 단계 화면으로 이동하면 그 화면에서는 자동으로 접혀 보인다.
 * (새로고침하면 접힌 상태로 시작한다. 편집기는 무거워서 일부러 저장하지 않는다)
 *
 * 색 테마와 편집기 크기(좌우 비율·높이)는 단계마다 다시 맞추지 않도록 localStorage에 저장한다.
 */
import { create } from "zustand";
import { isSandboxThemeChoice, type SandboxThemeChoice } from "@/features/curriculum/sandbox/sandboxThemes";

const THEME_STORAGE_KEY = "stageSandboxTheme";
const EDITOR_WIDTH_STORAGE_KEY = "stageSandboxEditorWidth";
const LAYOUT_HEIGHT_STORAGE_KEY = "stageSandboxLayoutHeight";

/** 크기 조절 범위. 너무 작거나 커져서 편집기·미리보기가 사라지지 않게 최소·최대를 둔다. */
interface SizeRange { min: number; max: number; initial: number; }
export const SANDBOX_EDITOR_WIDTH_RANGE: SizeRange = { min: 20, max: 80, initial: 50 }; // 편집기 너비(%), 나머지는 미리보기
export const SANDBOX_LAYOUT_HEIGHT_RANGE: SizeRange = { min: 320, max: 1000, initial: 560 }; // 편집기·미리보기 높이(px)

/** 값을 최소~최대 사이로 맞추고 정수로 만든다. */
export const clampSandboxSize = (value: number, range: SizeRange): number => Math.round(Math.min(range.max, Math.max(range.min, value)));

/** 저장된 크기를 읽는다. 없거나 숫자가 아니면 기본값, 범위를 벗어나면 범위 안으로 맞춘다. */
const readSavedSize = (storageKey: string, range: SizeRange): number => {
  const savedText = localStorage.getItem(storageKey);
  const savedNumber = savedText === null ? Number.NaN : Number(savedText);
  return Number.isFinite(savedNumber) ? clampSandboxSize(savedNumber, range) : range.initial;
};

/** 저장된 테마를 읽는다. 누구나 개발자 도구로 바꿀 수 있는 값이라 아는 값일 때만 쓰고, 아니면 사이트 테마를 따른다. */
const readSavedTheme = (): SandboxThemeChoice => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return isSandboxThemeChoice(savedTheme) ? savedTheme : "site";
};

interface StageSandboxState {
  expandedGuideId: string | null;
  themeChoice: SandboxThemeChoice;
  editorWidthPercent: number;
  layoutHeight: number;
  expand: (guideId: string) => void;
  toggle: (guideId: string) => void;
  setThemeChoice: (themeChoice: SandboxThemeChoice) => void;
  setEditorWidthPercent: (editorWidthPercent: number) => void;
  setLayoutHeight: (layoutHeight: number) => void;
}

export const useStageSandboxStore = create<StageSandboxState>()((set) => ({
  expandedGuideId: null,
  themeChoice: readSavedTheme(),
  editorWidthPercent: readSavedSize(EDITOR_WIDTH_STORAGE_KEY, SANDBOX_EDITOR_WIDTH_RANGE),
  layoutHeight: readSavedSize(LAYOUT_HEIGHT_STORAGE_KEY, SANDBOX_LAYOUT_HEIGHT_RANGE),
  expand: (guideId) => set({ expandedGuideId: guideId }),
  toggle: (guideId) => set((state) => ({ expandedGuideId: state.expandedGuideId === guideId ? null : guideId })),
  setThemeChoice: (themeChoice) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeChoice); // 다음 방문·다른 단계에서도 기억
    set({ themeChoice });
  },
  setEditorWidthPercent: (editorWidthPercent) => {
    const nextWidth = clampSandboxSize(editorWidthPercent, SANDBOX_EDITOR_WIDTH_RANGE);
    localStorage.setItem(EDITOR_WIDTH_STORAGE_KEY, String(nextWidth));
    set({ editorWidthPercent: nextWidth });
  },
  setLayoutHeight: (layoutHeight) => {
    const nextHeight = clampSandboxSize(layoutHeight, SANDBOX_LAYOUT_HEIGHT_RANGE);
    localStorage.setItem(LAYOUT_HEIGHT_STORAGE_KEY, String(nextHeight));
    set({ layoutHeight: nextHeight });
  },
}));

/** 편집기 영역의 HTML id. 메뉴에서 펼친 뒤 이 위치로 화면을 옮길 때 쓴다. */
export const STAGE_SANDBOX_SECTION_ID = "stage-sandbox-section";
