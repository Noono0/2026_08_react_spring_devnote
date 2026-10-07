import { useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { DataSourceToggle } from "./DataSourceToggle";
import { useDevelopmentSettingsStore } from "../state/developmentSettingsStore";

/**
 * 화면 구석의 개발용 디버그 패널(개발 메뉴를 켰을 때만 ApplicationLayout이 그린다).
 * 지금 쓰는 HTTP 구현·데이터 소스·가짜 시나리오·회원 번호·진행 중인 요청 수를 보여 주고,
 * TanStack Query 캐시를 한 번에 다시 받거나 비우는 버튼을 제공한다.
 */
export const DevelopmentDebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  // 지금 진행 중인 조회 요청 개수(0이면 모두 끝남).
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
          {/* invalidateQueries(): 모든 조회를 "오래됨"으로 표시해 화면에 있는 것부터 다시 받는다. clear(): 캐시를 통째로 비운다. */}
          <button onClick={() => void queryClient.invalidateQueries()}>모든 Query 다시 조회</button>
          <button onClick={() => queryClient.clear()}>Query 캐시 초기화</button>
        </div>
      ) : null}
    </aside>
  );
};
