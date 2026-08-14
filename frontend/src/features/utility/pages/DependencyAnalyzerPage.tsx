import { useMemo, useRef, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { analyzeDependencySource, createDependencyMarkdown, describeVersionRange, type DependencyAnalysisResult, type DependencyScope } from "@/features/utility/utils/dependencyAnalyzer";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const samplePackageJson = JSON.stringify({
  name: "devnote-frontend", version: "0.0.1",
  dependencies: { react: "19.2.7", "react-dom": "19.2.7", "react-router-dom": "6.30.1", "@tanstack/react-query": "5.87.4", axios: "1.11.0", zod: "4.1.5" },
  devDependencies: { typescript: "5.9.2", vite: "7.1.12", vitest: "4.0.0", eslint: "9.34.0" },
}, null, 2);

export const DependencyAnalyzerPage = () => {
  const fileInputReference = useRef<HTMLInputElement>(null);
  const initialResult = useMemo(() => analyzeDependencySource(samplePackageJson), []);
  const [source, setSource] = useState(samplePackageJson);
  const [result, setResult] = useState<DependencyAnalysisResult>(initialResult);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"ALL" | DependencyScope>("ALL");
  const [directOnly, setDirectOnly] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const scopes = useMemo(() => [...new Set(result.dependencies.map((dependency) => dependency.scope))], [result.dependencies]);
  const visibleDependencies = useMemo(() => result.dependencies.filter((dependency) => (!directOnly || dependency.direct) && (scope === "ALL" || dependency.scope === scope) && (!query.trim() || dependency.name.toLowerCase().includes(query.trim().toLowerCase()))), [directOnly, query, result.dependencies, scope]);
  const markdown = useMemo(() => createDependencyMarkdown(result), [result]);

  const analyze = (nextSource = source): void => {
    try { setResult(analyzeDependencySource(nextSource)); setErrorMessage(""); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "의존성을 분석하지 못했습니다."); }
  };
  const readFile = async (file?: File): Promise<void> => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setErrorMessage("파일은 8MB 이하만 선택할 수 있습니다."); return; }
    const text = await file.text(); setSource(text); analyze(text);
  };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page dependency-page">
      <UtilityPageTitle kicker="Developer Utility · Project Insight" title="Dependency Analyzer" description="NPM·Gradle 의존성을 운영·개발·직접·간접 범위로 분리하고 중복 해석 버전을 찾습니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="advanced-tool-actions"><button type="button" onClick={() => analyze()}>의존성 분석</button><button type="button" className="ghost-button" onClick={() => fileInputReference.current?.click()}>파일 선택</button><input ref={fileInputReference} type="file" hidden accept=".json,.gradle,.kts,.txt,application/json,text/plain" onChange={(event) => void readFile(event.target.files?.[0])} /><button type="button" className="ghost-button" onClick={() => { setSource(samplePackageJson); setResult(initialResult); setErrorMessage(""); }}>NPM 예제</button><button type="button" className="ghost-button" onClick={() => { const gradle = `plugins { id 'java' }\nversion = '1.0.0'\ndependencies {\n  implementation 'org.springframework.boot:spring-boot-starter-web:3.5.0'\n  implementation 'org.mybatis.spring.boot:mybatis-spring-boot-starter:3.0.4'\n  testImplementation 'org.springframework.boot:spring-boot-starter-test:3.5.0'\n}`; setSource(gradle); analyze(gradle); }}>Gradle 예제</button><button type="button" className="ghost-button" onClick={() => void copyText(markdown).then(() => applicationNotification.success("의존성 보고서를 복사했습니다."))}>보고서 복사</button><button type="button" className="ghost-button" onClick={() => downloadText("dependency-analysis.md", markdown, "text/markdown;charset=utf-8")}>다운로드</button></div>
      {errorMessage ? <p className="field-error advanced-error" role="alert">{errorMessage}</p> : null}
      <label className="advanced-source-editor dependency-source-editor"><span>package.json · package-lock.json · build.gradle · Gradle dependencies 결과</span><textarea aria-label="의존성 분석 입력" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} /></label>
      <section className="advanced-summary-strip"><article><span>Ecosystem</span><strong>{result.ecosystem}</strong><small>{result.sourceKind}</small></article><article><span>Project</span><strong>{result.projectName}</strong><small>{result.projectVersion || "버전 없음"}</small></article><article><span>Dependencies</span><strong>{result.dependencies.length}</strong><small>{result.dependencies.filter((item) => item.direct).length}개 직접 의존성</small></article><article><span>Conflicts</span><strong>{result.conflicts.length}</strong><small>여러 해석 버전 후보</small></article></section>
      {result.warnings.map((warning) => <p className="utility-warning" key={warning}>{warning}</p>)}
      <div className="dependency-workbench-grid"><section className="advanced-panel dependency-list-panel"><header><div><h2>Dependencies</h2><span>{visibleDependencies.length}/{result.dependencies.length}</span></div><div className="advanced-filter-row"><input aria-label="의존성 이름 검색" value={query} placeholder="group 또는 package 검색" onChange={(event) => setQuery(event.target.value)} /><select aria-label="의존성 Scope 필터" value={scope} onChange={(event) => setScope(event.target.value as "ALL" | DependencyScope)}><option value="ALL">전체 Scope</option>{scopes.map((item) => <option key={item}>{item}</option>)}</select><label className="checkbox-label"><input type="checkbox" checked={directOnly} onChange={(event) => setDirectOnly(event.target.checked)} />직접 의존성만</label></div></header><div className="dependency-table"><div><strong>Scope</strong><strong>Name</strong><strong>Requested</strong><strong>Resolved</strong><strong>종류</strong></div>{visibleDependencies.map((dependency) => <div key={dependency.id}><span className={`scope-${dependency.scope.toLowerCase()}`}>{dependency.scope}</span><code>{dependency.name}</code><span title={describeVersionRange(dependency.requestedVersion)}>{dependency.requestedVersion || "-"}</span><span>{dependency.resolvedVersion ?? "-"}</span><span>{dependency.direct ? "직접" : "간접"}</span></div>)}</div></section><aside className="advanced-panel dependency-insight-panel"><header><div><h2>Version Insights</h2><span>외부 Registry 조회 없음</span></div></header><h3>중복 버전 후보</h3>{result.conflicts.length > 0 ? <div className="dependency-conflict-list">{result.conflicts.map((conflict) => <article key={conflict.name}><strong>{conflict.name}</strong><span>{conflict.versions.join(" · ")}</span><small>{conflict.occurrences}개 경로에서 확인</small></article>)}</div> : <div className="portfolio-state-panel">입력 범위에서 여러 버전이 함께 나타난 패키지가 없습니다.</div>}<h3>버전 범위 읽기</h3><dl className="version-range-guide"><div><dt><code>^1.2.3</code></dt><dd>같은 major 범위</dd></div><div><dt><code>~1.2.3</code></dt><dd>같은 minor 범위</dd></div><div><dt><code>1.2.3</code></dt><dd>고정 버전</dd></div><div><dt><code>workspace:</code></dt><dd>로컬 Workspace</dd></div></dl></aside></div>
      <p className="utility-warning"><strong>분석 범위</strong> 최신 버전·취약점은 표시하지 않습니다. 정확한 보안 검사는 npm audit, Gradle dependencyInsight와 조직의 보안 도구를 함께 사용하세요.</p>
      <UtilityHelpDialog isOpen={helpOpen} title="Dependency Analyzer" description="프로젝트가 어떤 라이브러리에 의존하고 실제로 어떤 버전이 선택됐는지 정리합니다." onClose={() => setHelpOpen(false)}><article><h3>NPM</h3><p>package.json은 직접 의존성만, package-lock.json은 설치 경로와 간접 의존성까지 표시합니다.</p></article><article><h3>Gradle</h3><p>build.gradle은 선언 범위만 분석합니다. <code>gradlew dependencies</code> 결과를 붙이면 요청 버전과 충돌 해결 후 버전을 비교합니다.</p></article><article><h3>중복 버전</h3><p>같은 이름이 여러 실제 버전으로 나타나는 경우입니다. 항상 오류는 아니며 런타임·번들 구조를 확인할 출발점입니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
