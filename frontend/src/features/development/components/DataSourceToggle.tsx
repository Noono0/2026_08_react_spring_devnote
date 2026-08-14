import { toast } from "sonner";
import { useDevelopmentSettingsStore } from "../state/developmentSettingsStore";

interface DataSourceToggleProps {
  compact?: boolean;
}

/**
 * 실제 Spring Boot API와 MSW 더미 API를 전환하는 학습용 스위치입니다.
 *
 * MSW는 React가 렌더링되기 전에 시작되어야 하므로 값을 변경한 뒤
 * 페이지를 새로고침해 새로운 데이터 출처를 적용합니다.
 */
export const DataSourceToggle = ({ compact = false }: DataSourceToggleProps) => {
  const dataSource = useDevelopmentSettingsStore((state) => state.dataSource);
  const setDataSource = useDevelopmentSettingsStore((state) => state.setDataSource);
  const isMockDataEnabled = dataSource === "mock";

  const handleDataSourceToggle = (): void => {
    const nextDataSource = isMockDataEnabled ? "backend" : "mock";

    console.info("[DataSourceToggle] 데이터 출처 변경", {
      previousDataSource: dataSource,
      nextDataSource,
    });

    setDataSource(nextDataSource);

    toast.success(
      nextDataSource === "mock"
        ? "더미 데이터를 켰습니다."
        : "실제 백엔드 연결을 켰습니다.",
      {
        description: "새 설정을 적용하기 위해 화면을 다시 불러옵니다.",
        duration: 1_200,
      },
    );

    window.setTimeout(() => {
      window.location.reload();
    }, 350);
  };

  return (
    <div className={`data-source-toggle${compact ? " data-source-toggle-compact" : ""}`}>
      <div className="data-source-toggle-copy">
        <strong>{isMockDataEnabled ? "더미 데이터 ON" : "더미 데이터 OFF"}</strong>
        {!compact ? (
          <small>
            {isMockDataEnabled
              ? "MSW가 API 요청을 가로채 더미 응답을 반환합니다."
              : "Spring Boot API에 실제로 요청합니다."}
          </small>
        ) : null}
      </div>
      <button
        className={`data-source-switch${isMockDataEnabled ? " active" : ""}`}
        type="button"
        role="switch"
        aria-checked={isMockDataEnabled}
        aria-label={isMockDataEnabled ? "더미 데이터 끄기" : "더미 데이터 켜기"}
        title={isMockDataEnabled ? "더미 데이터 끄기" : "더미 데이터 켜기"}
        onClick={handleDataSourceToggle}
      >
        <span className="data-source-switch-handle" />
      </button>
    </div>
  );
};
