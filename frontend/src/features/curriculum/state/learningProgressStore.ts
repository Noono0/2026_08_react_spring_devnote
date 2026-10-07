/**
 * ============================================================================
 * learningProgressStore.ts — 학습 진도(완료한 단계·실습 과제)를 기억하는 저장소
 * ============================================================================
 *
 * [왜 전역 저장소(Zustand)일까?]
 *   진도는 로드맵 카드(완료 표시)와 각 화면의 ? 학습 가이드 대화상자(체크박스)가 함께 본다.
 *   한쪽에서 체크하면 다른 쪽도 바로 바뀌어야 하므로, 멀리 떨어진 컴포넌트가 같은 값을 보는 전역 저장소가 맞다.
 *
 * [persist + Zod 검증] — 21단계 practiceCartStore.ts와 같은 방식
 *   새로고침해도 남도록 localStorage에 저장한다. 저장값은 사용자가 고칠 수 있는 "믿을 수 없는 입력"이라
 *   다시 읽을 때 merge에서 Zod로 모양을 확인하고, 틀리면 빈 진도로 시작한다.
 *
 * [왜 21단계 저장소나 19단계 훅을 가져다 쓰지 않을까?]
 *   practice/ 폴더는 학습자가 실습하며 마음껏 고치는 곳이다.
 *   로드맵 같은 공통 기능이 그 코드를 import하면, 실습 중 바꾼 한 줄이 로드맵까지 망가뜨린다.
 *
 * [저장하는 값]
 *   completedStageIds : 완료한 단계의 guideId (예: "todo", "zustand")
 *   completedTaskKeys : 완료한 실습 과제. "guideId::과제 문장" 형태의 키다.
 *     과제 순서(번호)가 아니라 문장으로 키를 만들어, 과제 순서를 바꿔도 체크가 엉뚱한 과제로 옮겨 가지 않는다.
 */

import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const LEARNING_PROGRESS_STORAGE_KEY = "learningProgress";

// 저장값 검증 규칙. 너무 긴 문자열이나 지나치게 많은 항목은 깨진 값으로 보고 버린다.
const progressKeySchema = z.string().min(1).max(400);
const persistedProgressSchema = z.object({
  completedStageIds: z.array(progressKeySchema).max(200),
  completedTaskKeys: z.array(progressKeySchema).max(1000),
});

interface LearningProgressState {
  completedStageIds: string[];
  completedTaskKeys: string[];
  toggleStageCompleted: (guideId: string) => void;
  toggleTaskCompleted: (guideId: string, task: string) => void;
  resetProgress: () => void;
}

/** 실습 과제 하나를 가리키는 저장 키. */
export const createTaskProgressKey = (guideId: string, task: string): string => `${guideId}::${task}`;

/** 배열에 값이 있으면 빼고, 없으면 넣은 "새 배열"을 돌려준다(원래 배열은 건드리지 않는다). */
const toggleValue = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((existingValue) => existingValue !== value) : [...values, value];

export const useLearningProgressStore = create<LearningProgressState>()(
  persist(
    (set) => ({
      completedStageIds: [],
      completedTaskKeys: [],
      toggleStageCompleted: (guideId) => set((state) => ({ completedStageIds: toggleValue(state.completedStageIds, guideId) })),
      toggleTaskCompleted: (guideId, task) => set((state) => ({
        completedTaskKeys: toggleValue(state.completedTaskKeys, createTaskProgressKey(guideId, task)),
      })),
      resetProgress: () => set({ completedStageIds: [], completedTaskKeys: [] }),
    }),
    {
      name: LEARNING_PROGRESS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 함수는 저장할 수 없으므로 데이터 두 개만 저장한다.
      partialize: (state) => ({ completedStageIds: state.completedStageIds, completedTaskKeys: state.completedTaskKeys }),
      // 저장값 검증: 통과한 값만 현재 상태에 합친다.
      merge: (persistedState, currentState) => {
        const parsed = persistedProgressSchema.safeParse(persistedState);
        return parsed.success ? { ...currentState, ...parsed.data } : currentState;
      },
    },
  ),
);
