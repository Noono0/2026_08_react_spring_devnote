/**
 * developmentSettingsStore.ts — 개발 도구 설정 저장소(Zustand)
 *
 *   dataSource          : 실제 백엔드 API를 쓸지, MSW 가짜 API를 쓸지
 *   mockScenario        : MSW 가짜 API의 응답 상황(성공·지연·오류 등)
 *   developmentMemberId : 요청 헤더 X-Member-Id로 보낼 회원 번호(로그인 없이 다른 회원인 척 연습, requestHelpers.ts)
 * 값은 localStorage에도 저장해 새로고침 뒤에도 유지한다. 처음 값은 .env의 VITE_* 설정이다.
 */

import { create } from "zustand";
import {
  getSelectedDataSource,
  saveSelectedDataSource,
  type DataSourceMode,
} from "@/shared/config/dataSourceSelection";

interface DevelopmentSettingsState {
  dataSource: DataSourceMode;
  mockScenario: string;
  developmentMemberId: string;
  setDataSource: (dataSource: DataSourceMode) => void;
  setMockScenario: (mockScenario: string) => void;
  setDevelopmentMemberId: (developmentMemberId: string) => void;
}

export const useDevelopmentSettingsStore = create<DevelopmentSettingsState>((set) => ({
  dataSource: getSelectedDataSource(),
  mockScenario: localStorage.getItem("mockScenario") ?? import.meta.env.VITE_MOCK_SCENARIO,
  developmentMemberId:
    localStorage.getItem("developmentMemberId") ?? import.meta.env.VITE_DEVELOPMENT_MEMBER_ID,
  setDataSource: (dataSource) => {
    saveSelectedDataSource(dataSource);
    set({ dataSource });
  },
  setMockScenario: (mockScenario) => {
    localStorage.setItem("mockScenario", mockScenario);
    set({ mockScenario });
  },
  setDevelopmentMemberId: (developmentMemberId) => {
    localStorage.setItem("developmentMemberId", developmentMemberId);
    set({ developmentMemberId });
  },
}));
