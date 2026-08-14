import { useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { DataSourceToggle } from "./DataSourceToggle";
import { useDevelopmentSettingsStore } from "../state/developmentSettingsStore";

export const DevelopmentDebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const isFetchingCount = useIsFetching();
  const settings = useDevelopmentSettingsStore();

  return (
    <aside className={`debug-panel ${isOpen ? "open" : ""}`}>
      <button className="debug-panel-toggle" onClick={() => setIsOpen((current) => !current)}>
        {isOpen ? "디버그 닫기" : "디버그"}
      </button>
      {isOpen ? (
        <div className="debug-panel-content">
          <strong>개발 상태</strong>
          <dl>
            <dt>HTTP Client</dt>
            <dd>{import.meta.env.VITE_HTTP_CLIENT}</dd>
            <dt>Data Source</dt>
            <dd>{settings.dataSource}</dd>
            <dt>Mock Scenario</dt>
            <dd>{settings.mockScenario}</dd>
            <dt>Member ID</dt>
            <dd>{settings.developmentMemberId}</dd>
            <dt>Fetching</dt>
            <dd>{isFetchingCount}</dd>
          </dl>
          <DataSourceToggle compact />
          <button onClick={() => void queryClient.invalidateQueries()}>모든 Query 다시 조회</button>
          <button onClick={() => queryClient.clear()}>Query 캐시 초기화</button>
        </div>
      ) : null}
    </aside>
  );
};
