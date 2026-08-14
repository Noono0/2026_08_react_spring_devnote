import { applicationEnvironment } from "./applicationEnvironment";

export type DataSourceMode = "backend" | "mock";

const DATA_SOURCE_STORAGE_KEY = "devnoteDataSource";

const isDataSourceMode = (storedValue: string | null): storedValue is DataSourceMode =>
  storedValue === "backend" || storedValue === "mock";

/**
 * 현재 화면에서 사용할 데이터 출처를 반환합니다.
 *
 * 우선순위:
 * 1. 사용자가 화면에서 선택해 localStorage에 저장한 값
 * 2. 빌드 시 지정한 VITE_DATA_SOURCE 기본값
 */
export const getSelectedDataSource = (): DataSourceMode => {
  const storedDataSource = localStorage.getItem(DATA_SOURCE_STORAGE_KEY);

  if (isDataSourceMode(storedDataSource)) {
    return storedDataSource;
  }

  return applicationEnvironment.VITE_DATA_SOURCE;
};

/**
 * 데이터 출처 선택을 브라우저에 저장합니다.
 * MSW는 애플리케이션 시작 전에 켜져야 하므로 변경 후 화면을 새로고침해야 합니다.
 */
export const saveSelectedDataSource = (dataSource: DataSourceMode): void => {
  localStorage.setItem(DATA_SOURCE_STORAGE_KEY, dataSource);
};

export const resetSelectedDataSource = (): void => {
  localStorage.removeItem(DATA_SOURCE_STORAGE_KEY);
};
