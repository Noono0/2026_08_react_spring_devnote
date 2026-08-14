import { create } from "zustand";

export type ApplicationTheme = "light" | "dark";

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

const getInitialApplicationTheme = (): ApplicationTheme => {
  const savedTheme = localStorage.getItem("applicationTheme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyApplicationTheme = (applicationTheme: ApplicationTheme): void => {
  document.documentElement.dataset.theme = applicationTheme;
  document.documentElement.style.colorScheme = applicationTheme;
};

const initialApplicationTheme = getInitialApplicationTheme();
applyApplicationTheme(initialApplicationTheme);

export const useApplicationUiStore = create<ApplicationUiState>((set, get) => ({
  applicationTheme: initialApplicationTheme,
  isSidebarCollapsed: localStorage.getItem("isSidebarCollapsed") === "true",
  isMobileSidebarOpen: false,
  setApplicationTheme: (applicationTheme) => {
    localStorage.setItem("applicationTheme", applicationTheme);
    applyApplicationTheme(applicationTheme);
    set({ applicationTheme });
  },
  toggleApplicationTheme: () => {
    const nextApplicationTheme = get().applicationTheme === "dark" ? "light" : "dark";
    localStorage.setItem("applicationTheme", nextApplicationTheme);
    applyApplicationTheme(nextApplicationTheme);
    set({ applicationTheme: nextApplicationTheme });
  },
  toggleSidebarCollapsed: () => {
    const nextSidebarCollapsed = !get().isSidebarCollapsed;
    localStorage.setItem("isSidebarCollapsed", String(nextSidebarCollapsed));
    set({ isSidebarCollapsed: nextSidebarCollapsed });
  },
  openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
}));
