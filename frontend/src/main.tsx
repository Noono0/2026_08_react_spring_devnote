import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { startMockServerWhenEnabled } from "@/mocks/startMockServerWhenEnabled";
import { getSelectedDataSource } from "@/shared/config/dataSourceSelection";
import "./styles/global.css";
import "./styles/advancedUtilities.css";

const startApplication = async (): Promise<void> => {
  await startMockServerWhenEnabled();

  console.info("[Application] React 애플리케이션 시작", {
    strictMode: true,
    httpClient: import.meta.env.VITE_HTTP_CLIENT,
    dataSource: getSelectedDataSource(),
  });

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("root 요소를 찾을 수 없습니다.");
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

void startApplication();
