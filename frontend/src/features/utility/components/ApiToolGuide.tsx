/**
 * ============================================================================
 * ApiToolGuide.tsx — API 관련 도구 4개의 차이를 설명하는 공용 안내
 * ============================================================================
 *
 * [왜 이 컴포넌트가 필요한가]
 *   이 사이트에는 이름이 비슷한 API 도구가 네 개 있다.
 *     API Workspace / OpenAPI Studio / WebSocket · SSE Tester / Mock API Scenario
 *   각 도구의 도움말은 "이 도구가 무엇인지"는 설명했지만
 *   "그래서 지금 내가 열어야 할 건 어느 것인지"는 어디에도 없었다.
 *
 *   그래서 네 도구의 도움말 모두에 같은 비교표를 넣는다.
 *   어느 도구에서 도움말을 열든 전체 그림을 볼 수 있어야 길을 잃지 않는다.
 *
 * [왜 컴포넌트로 뺐나]
 *   같은 내용을 네 파일에 복붙하면 하나를 고칠 때 나머지 세 개가 어긋난다.
 *   도구가 추가되면 이 파일 한 곳만 고치면 된다.
 *
 * `currentTool` 을 받아 지금 보고 있는 도구를 강조한다.
 * 표에서 자기 위치를 알 수 있어야 비교가 쉬워진다.
 */

export type ApiToolKey = "WORKSPACE" | "OPENAPI" | "REALTIME" | "MOCK";

interface ApiToolRow {
  key: ApiToolKey;
  name: string;
  oneLine: string;
  useWhen: string;
  protocol: string;
}

const API_TOOL_ROWS: ApiToolRow[] = [
  {
    key: "WORKSPACE",
    name: "API Workspace",
    oneLine: "요청을 직접 만들어 보내고 응답을 확인합니다.",
    useWhen: "서버가 이미 있고, 요청이 제대로 가는지 확인하고 싶을 때",
    protocol: "HTTP (요청 → 응답 1회)",
  },
  {
    key: "OPENAPI",
    name: "OpenAPI Studio",
    oneLine: "API 문서를 읽어 요청 목록을 자동으로 만들어 줍니다.",
    useWhen: "Swagger 문서는 있는데 요청을 하나씩 만들기 번거로울 때",
    protocol: "HTTP (문서 → 요청 생성)",
  },
  {
    key: "REALTIME",
    name: "WebSocket · SSE Tester",
    oneLine: "연결을 열어 두고 오가는 메시지를 시간순으로 봅니다.",
    useWhen: "채팅·알림처럼 연결이 끊기지 않고 계속 주고받는 기능을 볼 때",
    protocol: "WebSocket / SSE (연결 유지)",
  },
  {
    key: "MOCK",
    name: "Mock API Scenario",
    oneLine: "서버 없이 가짜 응답을 만들어 돌려줍니다.",
    useWhen: "백엔드가 아직 없거나, 오류·지연 화면을 만들어 봐야 할 때",
    protocol: "mock:// (브라우저 안에서 처리)",
  },
];

interface ApiToolGuideProps {
  currentTool: ApiToolKey;
}

export const ApiToolGuide = ({ currentTool }: ApiToolGuideProps) => (
  <article className="api-tool-guide">
    <h3>API 도구 네 가지, 무엇이 다른가요?</h3>
    <p className="api-tool-guide-lead">
      이름이 비슷해 헷갈리기 쉽습니다. <strong>지금 하려는 일</strong>을 기준으로 고르면 됩니다.
    </p>

    <div className="api-tool-guide-table-wrapper">
      <table className="api-tool-guide-table">
        <thead>
          <tr>
            <th scope="col">도구</th>
            <th scope="col">하는 일</th>
            <th scope="col">이럴 때 씁니다</th>
            <th scope="col">통신 방식</th>
          </tr>
        </thead>
        <tbody>
          {API_TOOL_ROWS.map((row) => (
            // 지금 보고 있는 도구를 강조해 표에서 자기 위치를 찾기 쉽게 한다.
            <tr key={row.key} className={row.key === currentTool ? "api-tool-guide-current" : undefined}>
              <th scope="row">
                {row.name}
                {row.key === currentTool ? <span className="api-tool-guide-badge">지금 보는 도구</span> : null}
              </th>
              <td>{row.oneLine}</td>
              <td>{row.useWhen}</td>
              <td>{row.protocol}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <h3>HTTP와 실시간 연결은 무엇이 다른가요?</h3>
    <p>
      HTTP는 <strong>편지</strong>에 가깝습니다. 요청을 보내면 답장이 오고 그걸로 끝입니다.
      새 내용이 필요하면 다시 요청해야 합니다. API Workspace·OpenAPI Studio·Mock API가 이 방식입니다.
    </p>
    <p>
      WebSocket과 SSE는 <strong>전화</strong>에 가깝습니다. 한 번 연결하면 끊을 때까지 유지되고,
      서버가 먼저 말을 걸 수 있습니다. 그래서 알림이나 채팅에 씁니다.
      둘의 차이는 방향입니다. <strong>WebSocket은 양방향</strong>(둘 다 말함),
      <strong> SSE는 단방향</strong>(서버만 말함)입니다.
    </p>

    <h3>실무에서는 이런 순서로 이어집니다</h3>
    <ol className="api-tool-guide-flow">
      <li><strong>OpenAPI Studio</strong>에서 API 문서를 가져와 요청 목록을 만든다</li>
      <li><strong>API Workspace</strong>에서 그 요청을 실행하고 응답을 확인한다</li>
      <li>서버가 아직 없다면 <strong>Mock API</strong>로 가짜 응답을 만들어 화면을 먼저 개발한다</li>
      <li>실시간 기능이라면 <strong>WebSocket · SSE Tester</strong>로 연결과 메시지를 확인한다</li>
    </ol>
  </article>
);
