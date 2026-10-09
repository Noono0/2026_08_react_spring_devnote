/**
 * stageSandboxStore.ts — "어느 단계의 사이트 안 편집기가 펼쳐져 있는지"를 공유하는 작은 저장소
 *
 * 제목 옆 "직접 해 보기" 메뉴(OnlinePracticeMenu)와 연습 화면 맨 아래 편집기 영역(StageSandboxSection)은
 * 화면에서 멀리 떨어진 컴포넌트라 props로 이어 주기 어렵다. 그래서 둘이 같은 값을 보는 전역 저장소를 쓴다.
 *
 * 펼쳐진 단계를 guideId로 기억하므로, 다른 단계 화면으로 이동하면 그 화면에서는 자동으로 접혀 보인다.
 * (새로고침하면 접힌 상태로 시작한다. 편집기는 무거워서 일부러 저장하지 않는다)
 */
import { create } from "zustand";

interface StageSandboxState {
  expandedGuideId: string | null;
  expand: (guideId: string) => void;
  toggle: (guideId: string) => void;
}

export const useStageSandboxStore = create<StageSandboxState>()((set) => ({
  expandedGuideId: null,
  expand: (guideId) => set({ expandedGuideId: guideId }),
  toggle: (guideId) => set((state) => ({ expandedGuideId: state.expandedGuideId === guideId ? null : guideId })),
}));

/** 편집기 영역의 HTML id. 메뉴에서 펼친 뒤 이 위치로 화면을 옮길 때 쓴다. */
export const STAGE_SANDBOX_SECTION_ID = "stage-sandbox-section";
