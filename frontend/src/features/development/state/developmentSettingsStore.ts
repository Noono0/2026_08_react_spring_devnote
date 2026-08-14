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
