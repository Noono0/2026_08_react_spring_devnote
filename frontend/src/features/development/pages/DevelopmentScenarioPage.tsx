import { DataSourceToggle } from "../components/DataSourceToggle";
import { useDevelopmentSettingsStore } from "../state/developmentSettingsStore";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";

const mockScenarios = [
  "success",
  "empty-data",
  "slow-response",
  "server-error",
  "network-error",
  "unauthorized",
  "version-conflict",
];

/**
 * 실제 API와 더미 API를 바꾸고 오류 상황을 재현하는 학습 페이지입니다.
 */
export const DevelopmentScenarioPage = () => {
  const settings = useDevelopmentSettingsStore();
  const isMockDataEnabled = settings.dataSource === "mock";

  return (
    <section>
      <LearningGuideTitle guideId="development">API·더미 데이터 실습</LearningGuideTitle>
      <p>
        실제 Spring Boot 통신과 MSW 더미 응답을 화면에서 전환하고, 다양한 오류 상황을
        재현합니다.
      </p>

      <div className="scenario-section-card">
        <h2>데이터 출처 ON/OFF</h2>
        <DataSourceToggle />
        <p className="notice-box">
          스위치를 변경하면 MSW 시작 상태를 다시 설정하기 위해 화면이 자동으로 새로고침됩니다.
          더미 데이터 ON에서는 백엔드가 꺼져 있어도 문서 CRUD 화면을 연습할 수 있습니다.
        </p>
      </div>

      <div className="scenario-grid">
        <label>
          Mock 시나리오
          <select
            value={settings.mockScenario}
            disabled={!isMockDataEnabled}
            onChange={(changeEvent) => settings.setMockScenario(changeEvent.target.value)}
          >
            {mockScenarios.map((scenario) => (
              <option key={scenario} value={scenario}>
                {scenario}
              </option>
            ))}
          </select>
          <small>
            {isMockDataEnabled
              ? "선택한 오류·지연 상황이 다음 API 요청부터 적용됩니다."
              : "더미 데이터를 켜야 Mock 시나리오를 사용할 수 있습니다."}
          </small>
        </label>

        <label>
          개발 회원
          <select
            value={settings.developmentMemberId}
            onChange={(changeEvent) => settings.setDevelopmentMemberId(changeEvent.target.value)}
          >
            <option value="1">1 - 일반 사용자</option>
            <option value="2">2 - 팀 관리자</option>
            <option value="3">3 - 관리자</option>
            <option value="4">4 - 조회 전용</option>
          </select>
          <small>권한별 동작 차이를 확인할 때 사용합니다.</small>
        </label>
      </div>

      <div className="scenario-explanation-grid">
        <article>
          <strong>더미 데이터 OFF</strong>
          <p>Axios 또는 Fetch가 Nginx를 거쳐 Spring Boot API에 실제 요청을 보냅니다.</p>
        </article>
        <article>
          <strong>더미 데이터 ON</strong>
          <p>MSW가 같은 API 주소를 가로채 성공·지연·오류 응답을 브라우저에서 반환합니다.</p>
        </article>
      </div>
    </section>
  );
};
