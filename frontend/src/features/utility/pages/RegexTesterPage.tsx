import { useMemo, useState } from "react";
import { executeJavaRegex } from "@/features/utility/api/regexApi";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText } from "@/features/utility/utils/browserFileUtils";
import { explainRegex, hasPotentialRedosRisk, runJavaScriptRegex, type RegexExecutionResult, type RegexMode } from "@/features/utility/utils/regexTester";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const examples = [
  { label: "아이디", pattern: "^[a-zA-Z0-9]{4,12}$", flags: "", input: "devnote01\n짧음" },
  { label: "이메일", pattern: "(?<local>[a-zA-Z0-9._%+-]+)@(?<domain>[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})", flags: "gi", input: "문의: hello@devnote.com, admin@example.org" },
  { label: "날짜", pattern: "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})", flags: "g", input: "작성 2026-08-13 / 수정 2026-08-14" },
];

const HighlightedMatches = ({ input, result }: { input: string; result?: RegexExecutionResult }) => {
  if (!result || result.matches.length === 0) return <pre>{input || "일치 결과가 없습니다."}</pre>;
  const fragments: Array<{ text: string; matched: boolean }> = [];
  let cursor = 0;
  result.matches.forEach((match) => {
    if (match.start > cursor) fragments.push({ text: input.slice(cursor, match.start), matched: false });
    fragments.push({ text: input.slice(match.start, match.end) || " ", matched: true });
    cursor = Math.max(cursor, match.end);
  });
  if (cursor < input.length) fragments.push({ text: input.slice(cursor), matched: false });
  return <pre>{fragments.map((fragment, index) => fragment.matched ? <mark key={`${index}-${fragment.text}`}>{fragment.text}</mark> : <span key={`${index}-${fragment.text}`}>{fragment.text}</span>)}</pre>;
};

export const RegexTesterPage = () => {
  const [engine, setEngine] = useState<"JAVASCRIPT" | "JAVA">("JAVASCRIPT");
  const [mode, setMode] = useState<RegexMode>("FIND");
  const [pattern, setPattern] = useState(examples[1]?.pattern ?? "");
  const [flags, setFlags] = useState(examples[1]?.flags ?? "g");
  const [input, setInput] = useState(examples[1]?.input ?? "");
  const [replacement, setReplacement] = useState("[$&]");
  const [result, setResult] = useState<RegexExecutionResult>();
  const [errorMessage, setErrorMessage] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [beginnerMode, setBeginnerMode] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const explanation = useMemo(() => explainRegex(pattern), [pattern]);
  const redosWarning = useMemo(() => hasPotentialRedosRisk(pattern), [pattern]);

  const execute = async (): Promise<void> => {
    setIsExecuting(true);
    setErrorMessage("");
    try {
      const nextResult = engine === "JAVASCRIPT"
        ? runJavaScriptRegex(pattern, flags, input, mode, replacement)
        : await executeJavaRegex({ pattern, flags, input, mode, replacement });
      setResult(nextResult);
    } catch (error) {
      setResult(undefined);
      setErrorMessage(error instanceof Error ? error.message : "정규식을 실행하지 못했습니다.");
    } finally {
      setIsExecuting(false);
    }
  };

  const loadExample = (exampleIndex: number): void => {
    const example = examples[exampleIndex];
    if (!example) return;
    setPattern(example.pattern); setFlags(example.flags); setInput(example.input); setResult(undefined); setErrorMessage("");
  };

  const codeSamples = {
    literal: `/${pattern.replace(/\//g, "\\/")}/${flags}`,
    constructor: `new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)})`,
    java: `Pattern.compile(${JSON.stringify(pattern)}${flags.includes("i") ? ", Pattern.CASE_INSENSITIVE" : ""})`,
  };
  const copyCodeSample = (value: string, label: string): void => {
    void copyText(value).then(() => applicationNotification.success(`${label} 코드를 복사했습니다.`));
  };

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Learn Regex" title="Regex Tester" description="JavaScript와 Java의 실제 정규식 엔진으로 찾기·전체 일치·치환을 비교합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-toolbar regex-toolbar">
        <div className="segmented-buttons" role="group" aria-label="정규식 엔진"><button type="button" className={engine === "JAVASCRIPT" ? "active" : undefined} onClick={() => setEngine("JAVASCRIPT")}>JavaScript</button><button type="button" className={engine === "JAVA" ? "active" : undefined} onClick={() => setEngine("JAVA")}>Java</button></div>
        <div className="segmented-buttons" role="group" aria-label="실행 모드">{(["FIND", "FULL", "REPLACE"] as const).map((item) => <button type="button" className={mode === item ? "active" : undefined} key={item} onClick={() => setMode(item)}>{item === "FIND" ? "부분 찾기" : item === "FULL" ? "전체 일치" : "치환"}</button>)}</div>
        <label className="checkbox-label"><input type="checkbox" checked={beginnerMode} onChange={(event) => setBeginnerMode(event.target.checked)} />초보자 설명</label>
      </div>
      <div className="regex-example-buttons"><span>예제</span>{examples.map((example, index) => <button type="button" className="ghost-button" key={example.label} onClick={() => loadExample(index)}>{example.label}</button>)}</div>
      <section className="regex-input-panel">
        <label className="regex-pattern-field"><span>정규식 패턴</span><div><strong>/</strong><input aria-label="정규식 패턴" value={pattern} spellCheck={false} onChange={(event) => { setPattern(event.target.value); setResult(undefined); }} /><strong>/</strong><input className="regex-flags-input" aria-label="정규식 플래그" value={flags} placeholder="gim" onChange={(event) => { setFlags(event.target.value); setResult(undefined); }} /></div></label>
        {mode === "REPLACE" ? <label><span>치환 문자열</span><input value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label> : null}
        <label><span>테스트 문자열</span><textarea aria-label="테스트 문자열" value={input} spellCheck={false} onChange={(event) => { setInput(event.target.value); setResult(undefined); }} /></label>
        {redosWarning ? <p className="utility-warning" role="alert">⚠ 중첩된 반복 표현이 있어 입력에 따라 실행 시간이 크게 늘어나는 ReDoS 위험이 있습니다.</p> : null}
        <button type="button" disabled={isExecuting || !pattern} onClick={() => void execute()}>{isExecuting ? "실행 중…" : `${engine === "JAVA" ? "Java" : "JavaScript"}로 실행`}</button>
      </section>
      {errorMessage ? <p className="field-error" role="alert">{errorMessage}</p> : null}
      <div className="regex-result-grid">
        <section className="tool-result-card"><header><h2>매칭 강조</h2><span>{result ? `${result.matches.length}개 일치` : "실행 전"}</span></header><HighlightedMatches input={input} result={result} />{result?.truncated ? <p className="utility-warning">처음 200개 결과만 표시합니다.</p> : null}</section>
        <section className="tool-result-card"><header><h2>매칭 목록</h2></header>{!result ? <div className="portfolio-state-panel">실행하면 위치와 그룹이 표시됩니다.</div> : result.matches.length === 0 ? <div className="portfolio-state-panel">일치하는 내용이 없습니다.</div> : <ol className="regex-match-list">{result.matches.map((match, index) => <li key={`${match.start}-${index}`}><div><strong>{match.match || "(빈 문자열)"}</strong><span>{match.start}–{match.end}</span></div>{match.groups.length > 0 ? <ul>{match.groups.map((group, groupIndex) => <li key={`${group.name}-${groupIndex}`}><code>{group.name}</code> {group.value || "(빈 값)"}</li>)}</ul> : null}</li>)}</ol>}</section>
      </div>
      {mode === "REPLACE" && result ? <section className="tool-result-card"><header><h2>치환 결과</h2><button type="button" className="ghost-button" onClick={() => void copyText(result.replacedText ?? "").then(() => applicationNotification.success("치환 결과를 복사했습니다."))}>복사</button></header><pre>{result.replacedText}</pre></section> : null}
      {beginnerMode ? <section className="regex-explanation-panel"><header><h2>패턴을 토큰별로 읽기</h2><p>자동 설명은 학습 보조이며 복잡한 엔진별 문법을 완벽히 해석하지는 않습니다.</p></header><div>{explanation.map((token, index) => <article key={`${token.token}-${index}`}><code>{token.token}</code><span>{token.description}</span></article>)}</div><div className="regex-code-samples"><label>JavaScript 리터럴<div className="input-copy-row"><input readOnly value={codeSamples.literal} /><button type="button" className="ghost-button" onClick={() => copyCodeSample(codeSamples.literal, "JavaScript 리터럴")}>복사</button></div></label><label>RegExp 생성자<div className="input-copy-row"><input readOnly value={codeSamples.constructor} /><button type="button" className="ghost-button" onClick={() => copyCodeSample(codeSamples.constructor, "RegExp 생성자")}>복사</button></div></label><label>Java Pattern<div className="input-copy-row"><input readOnly value={codeSamples.java} /><button type="button" className="ghost-button" onClick={() => copyCodeSample(codeSamples.java, "Java Pattern")}>복사</button></div></label></div></section> : null}
      <UtilityHelpDialog isOpen={helpOpen} title="Regex Tester" description="실제 엔진 실행 결과와 초보자용 패턴 설명을 함께 확인합니다." onClose={() => setHelpOpen(false)}>
        <article><h3>실행 모드</h3><ul><li>부분 찾기: 문자열 안의 모든 일치를 찾습니다.</li><li>전체 일치: 입력 전체가 패턴과 일치해야 성공합니다.</li><li>치환: 일치한 내용을 지정한 문자열로 바꿉니다.</li></ul></article>
        <article><h3>엔진 차이</h3><p>JavaScript는 브라우저 RegExp, Java는 Spring Boot의 java.util.regex.Pattern을 실제로 실행합니다. Java의 matches()는 전체 일치, Matcher.find()는 부분 찾기에 해당합니다.</p></article>
        <article><h3>안전</h3><p>입력은 100,000자, 결과는 200개로 제한합니다. 중첩 반복 패턴에는 ReDoS 가능성 경고를 표시합니다.</p></article>
      </UtilityHelpDialog>
    </section>
  );
};
