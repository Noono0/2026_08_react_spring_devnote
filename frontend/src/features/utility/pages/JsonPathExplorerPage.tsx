import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { evaluateJsonPath, jsonPathForChild, type JsonPathMatch } from "@/features/utility/utils/jsonPathExplorer";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const sampleJson = JSON.stringify({
  store: {
    books: [
      { id: 1, title: "React 기초", category: "frontend", price: 18000, tags: ["react", "beginner"] },
      { id: 2, title: "Spring Boot API", category: "backend", price: 26000, tags: ["java", "api"] },
      { id: 3, title: "React 실전 패턴", category: "frontend", price: 32000, tags: ["react", "advanced"] },
    ],
    owner: { name: "DevNote", active: true },
  },
}, null, 2);

const parseJsonValue = (source: string): unknown => JSON.parse(source) as unknown;

const queryExamples = [
  { label: "모든 책", value: "$.store.books[*]" },
  { label: "제목만", value: "$.store.books[*].title" },
  { label: "2만원 이상", value: "$.store.books[?(@.price >= 20000)]" },
  { label: "앞의 두 권", value: "$.store.books[0:2]" },
  { label: "모든 price", value: "$..price" },
];

interface JsonTreeNodeProps {
  value: unknown;
  path: string;
  label: string;
  depth: number;
  matchedPaths: Set<string>;
  onPathSelect: (path: string) => void;
}

const JsonTreeNode = ({ value, path, label, depth, matchedPaths, onPathSelect }: JsonTreeNodeProps) => {
  const isContainer = value !== null && typeof value === "object";
  const entries: Array<readonly [string | number, unknown]> = Array.isArray(value)
    ? (value as unknown[]).slice(0, 200).map((item, index) => [index, item] as const)
    : isContainer
      ? Object.entries(value as Record<string, unknown>).slice(0, 200)
      : [];
  if (!isContainer) return <div className={`json-tree-leaf${matchedPaths.has(path) ? " matched" : ""}`}><button type="button" title="이 경로를 Query로 사용" onClick={() => onPathSelect(path)}>{label}</button><span>{typeof value === "string" ? JSON.stringify(value) : String(value)}</span></div>;
  return <details className={`json-tree-branch${matchedPaths.has(path) ? " matched" : ""}`} open={depth < 2}><summary><button type="button" title="이 경로를 Query로 사용" onClick={(event) => { event.preventDefault(); onPathSelect(path); }}>{label}</button><span>{Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`}</span></summary><div>{entries.map(([key, child]) => <JsonTreeNode key={String(key)} value={child} path={jsonPathForChild(path, key)} label={String(key)} depth={depth + 1} matchedPaths={matchedPaths} onPathSelect={onPathSelect} />)}{entries.length >= 200 ? <small>처음 200개 항목만 트리에 표시합니다.</small> : null}</div></details>;
};

export const JsonPathExplorerPage = () => {
  const [source, setSource] = useState(sampleJson);
  const [query, setQuery] = useState("$.store.books[?(@.price >= 20000)]");
  const [parsedValue, setParsedValue] = useState<unknown>(() => parseJsonValue(sampleJson));
  const [matches, setMatches] = useState<JsonPathMatch[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const matchedPaths = useMemo(() => new Set(matches.map((match) => match.path)), [matches]);
  const resultValue = matches.length === 1 ? matches[0]?.value : matches.map((match) => match.value);
  const resultText = matches.length === 0 ? "" : JSON.stringify(resultValue, null, 2);

  const runQuery = (nextQuery = query): void => {
    try {
      const nextValue = parseJsonValue(source);
      const nextMatches = evaluateJsonPath(nextValue, nextQuery);
      setParsedValue(nextValue); setMatches(nextMatches); setErrorMessage("");
    } catch (error) {
      setMatches([]); setErrorMessage(error instanceof SyntaxError ? `JSON 문법 오류: ${error.message}` : error instanceof Error ? error.message : "JSONPath를 실행하지 못했습니다.");
    }
  };

  const selectPath = (path: string): void => { setQuery(path); try { const value = parseJsonValue(source); setParsedValue(value); setMatches(evaluateJsonPath(value, path)); setErrorMessage(""); } catch (error) { setErrorMessage(error instanceof Error ? error.message : "경로를 실행하지 못했습니다."); } };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page jsonpath-page">
      <UtilityPageTitle kicker="Developer Utility · JSON Query" title="JSONPath Explorer" description="큰 JSON에서 필요한 노드를 경로로 선택하고 원본 트리와 결과 위치를 함께 확인합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="jsonpath-query-bar"><span>$</span><input aria-label="JSONPath Query" value={query} onKeyDown={(event) => { if (event.key === "Enter") runQuery(); }} onChange={(event) => setQuery(event.target.value)} /><button type="button" onClick={() => runQuery()}>Query 실행</button></div>
      <div className="jsonpath-examples">{queryExamples.map((example) => <button type="button" className={query === example.value ? "active" : undefined} key={example.value} onClick={() => { setQuery(example.value); runQuery(example.value); }}>{example.label}<code>{example.value}</code></button>)}</div>
      {errorMessage ? <p className="field-error advanced-error" role="alert">{errorMessage}</p> : null}
      <div className="jsonpath-workbench-grid">
        <section className="advanced-panel jsonpath-input-panel"><header><div><h2>JSON 입력</h2><span>{new Blob([source]).size.toLocaleString("ko-KR")} bytes</span></div><button type="button" className="ghost-button" onClick={() => { setSource(sampleJson); setParsedValue(parseJsonValue(sampleJson)); setMatches([]); setErrorMessage(""); }}>예제 복원</button></header><textarea aria-label="JSONPath 원본 JSON" value={source} spellCheck={false} onChange={(event) => { setSource(event.target.value); setMatches([]); }} /></section>
        <section className="advanced-panel jsonpath-tree-panel"><header><div><h2>JSON Tree</h2><span>노드 이름을 누르면 경로를 Query로 사용합니다.</span></div></header><div className="json-tree-view"><JsonTreeNode value={parsedValue} path="$" label="$ root" depth={0} matchedPaths={matchedPaths} onPathSelect={selectPath} /></div></section>
        <section className="advanced-panel jsonpath-result-panel"><header><div><h2>결과</h2><span>{matches.length}개 일치</span></div><div><button type="button" className="ghost-button" disabled={!resultText} onClick={() => void copyText(resultText).then(() => applicationNotification.success("결과를 복사했습니다."))}>복사</button><button type="button" className="ghost-button" disabled={!resultText} onClick={() => downloadText("jsonpath-result.json", resultText, "application/json;charset=utf-8")}>다운로드</button></div></header><div className="jsonpath-match-list">{matches.map((match, index) => <article key={`${match.path}:${index}`}><button type="button" onClick={() => void copyText(match.path).then(() => applicationNotification.success("경로를 복사했습니다."))}><code>{match.path}</code><span>경로 복사</span></button><pre>{JSON.stringify(match.value, null, 2) ?? String(match.value)}</pre></article>)}{matches.length === 0 ? <div className="portfolio-state-panel">Query를 실행하면 일치 경로와 값이 표시됩니다.</div> : null}</div></section>
      </div>
      <UtilityHelpDialog isOpen={helpOpen} title="JSONPath Explorer" description="JSON을 트리로 보고 필요한 부분만 선택하는 경로 문법을 연습합니다." onClose={() => setHelpOpen(false)}><article><h3>지원 문법</h3><p><code>$.user.name</code>, <code>$['user']</code>, <code>[0]</code>, <code>[-1]</code>, <code>[*]</code>, <code>[0:3]</code>, <code>[0,2]</code>, <code>$..price</code>, <code>[?(@.price &gt;= 1000)]</code>을 지원합니다.</p></article><article><h3>Formatter와 차이</h3><p>Formatter는 전체 JSON의 모양을 정리하고, JSONPath는 조건에 맞는 일부 노드를 선택합니다.</p></article><article><h3>제한</h3><p>학습용 엔진은 5,000개 결과와 단일 속성 필터를 지원합니다. Script Expression과 사용자 함수는 안전을 위해 실행하지 않습니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
