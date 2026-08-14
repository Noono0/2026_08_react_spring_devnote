import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { analyzeLogs, createLogAnalysisMarkdown, type LogAnalysisResult, type LogLevel } from "@/features/utility/utils/logAnalyzer";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const sampleLog = `2026-08-14 20:10:11.302 ERROR 1224 --- [http-nio-8080-exec-3] com.example.devnote.member.MemberService : 회원 조회 실패
java.lang.IllegalStateException: 회원 상세 데이터를 만들 수 없습니다.
    at com.example.devnote.member.MemberService.findMember(MemberService.java:42)
    at com.example.devnote.member.MemberController.getMember(MemberController.java:28)
    at org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:1089)
Caused by: org.apache.ibatis.exceptions.PersistenceException: Mapper 실행 실패
    at org.apache.ibatis.session.defaults.DefaultSqlSession.selectOne(DefaultSqlSession.java:75)
Caused by: java.sql.SQLSyntaxErrorException: Unknown column 'member_name' in 'field list'
    at com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:121)
2026-08-14 20:10:12.010 WARN com.example.devnote.audit.AuditLogger - 요청 실패 memberId=7
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnop.qrstuvwxyz123456
password=do-not-store-this`;

type LogView = "SUMMARY" | "EXCEPTIONS" | "ENTRIES" | "REDACTED";

export const LogAnalyzerPage = () => {
  const fileInputReference = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState(sampleLog);
  const [analysis, setAnalysis] = useState<LogAnalysisResult>(() => analyzeLogs(sampleLog));
  const [view, setView] = useState<LogView>("SUMMARY");
  const [level, setLevel] = useState<"ALL" | LogLevel>("ALL");
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const report = useMemo(() => createLogAnalysisMarkdown(analysis), [analysis]);
  const visibleEntries = useMemo(() => analysis.entries.filter((entry) => (level === "ALL" || entry.level === level) && (!query.trim() || [entry.message, entry.logger, entry.raw].some((value) => value?.toLowerCase().includes(query.trim().toLowerCase())))), [analysis.entries, level, query]);

  const runAnalysis = (nextSource = source): void => {
    try { setAnalysis(analyzeLogs(nextSource)); setErrorMessage(""); setView("SUMMARY"); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "로그를 분석하지 못했습니다."); }
  };
  const readFile = async (file?: File): Promise<void> => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErrorMessage("로그 파일은 5MB 이하만 선택할 수 있습니다."); return; }
    const text = await file.text(); setSource(text); runAnalysis(text);
  };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page log-analyzer-page">
      <UtilityPageTitle kicker="Developer Utility · Troubleshooting" title="Log · Stack Trace Analyzer" description="Java·Spring·JavaScript 로그에서 Exception 계층, 애플리케이션 Frame, SQL 신호와 반복 오류를 찾습니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="advanced-tool-actions"><button type="button" onClick={() => runAnalysis()}>로그 분석</button><button type="button" className="ghost-button" onClick={() => fileInputReference.current?.click()}>로그 파일 선택</button><input ref={fileInputReference} type="file" hidden accept=".log,.txt,text/plain" onChange={(event) => void readFile(event.target.files?.[0])} /><button type="button" className="ghost-button" onClick={() => { setSource(sampleLog); runAnalysis(sampleLog); }}>예제 복원</button><button type="button" className="ghost-button" onClick={() => void copyText(report).then(() => applicationNotification.success("분석 보고서를 복사했습니다."))}>보고서 복사</button><button type="button" className="ghost-button" onClick={() => downloadText("log-analysis.md", report, "text/markdown;charset=utf-8")}>Markdown 다운로드</button><Link className="secondary-link compact-link" to="/history/new">업무 History 작성</Link></div>
      {errorMessage ? <p className="field-error advanced-error" role="alert">{errorMessage}</p> : null}
      <label className="advanced-source-editor log-source-editor"><span>로그 또는 Stack Trace</span><textarea aria-label="분석할 로그" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} /></label>
      <section className="advanced-summary-strip"><article><span>Lines</span><strong>{analysis.sourceLineCount.toLocaleString("ko-KR")}</strong><small>{analysis.truncated ? "50,000줄까지만 분석" : "전체 분석"}</small></article><article><span>Errors</span><strong>{analysis.levelCounts.ERROR + analysis.levelCounts.FATAL}</strong><small>ERROR · FATAL</small></article><article><span>Exceptions</span><strong>{analysis.exceptions.length}</strong><small>{analysis.rootCause?.type.split(".").at(-1) ?? "Root Cause 없음"}</small></article><article><span>Redacted</span><strong>{analysis.sensitiveValueCount}</strong><small>민감정보 마스킹</small></article></section>
      <div className="utility-mode-tabs" role="tablist" aria-label="로그 분석 결과"><button type="button" role="tab" aria-selected={view === "SUMMARY"} className={view === "SUMMARY" ? "active" : undefined} onClick={() => setView("SUMMARY")}>요약</button><button type="button" role="tab" aria-selected={view === "EXCEPTIONS"} className={view === "EXCEPTIONS" ? "active" : undefined} onClick={() => setView("EXCEPTIONS")}>Exception · Stack</button><button type="button" role="tab" aria-selected={view === "ENTRIES"} className={view === "ENTRIES" ? "active" : undefined} onClick={() => setView("ENTRIES")}>로그 목록</button><button type="button" role="tab" aria-selected={view === "REDACTED"} className={view === "REDACTED" ? "active" : undefined} onClick={() => setView("REDACTED")}>마스킹 원문</button></div>
      {view === "SUMMARY" ? <div className="log-summary-grid"><section className="advanced-panel root-cause-card"><header><h2>Root Cause</h2><span>{analysis.rootCause ? `line ${analysis.rootCause.lineNumber}` : "찾지 못함"}</span></header>{analysis.rootCause ? <><strong>{analysis.rootCause.type}</strong><p>{analysis.rootCause.message || "메시지 없음"}</p></> : <div className="portfolio-state-panel">Exception 또는 Error 이름을 찾지 못했습니다.</div>}</section><section className="advanced-panel"><header><h2>Level 분포</h2></header><div className="log-level-bars">{(["ERROR", "WARN", "INFO", "DEBUG", "TRACE", "UNKNOWN"] as LogLevel[]).map((item) => { const count = analysis.levelCounts[item]; const maximum = Math.max(1, ...Object.values(analysis.levelCounts)); return <div key={item}><strong>{item}</strong><span><i style={{ width: `${count / maximum * 100}%` }} /></span><em>{count}</em></div>; })}</div></section><section className="advanced-panel"><header><h2>반복 메시지</h2><span>숫자·UUID 정규화</span></header>{analysis.repeatedMessages.length > 0 ? <ol className="repeated-log-list">{analysis.repeatedMessages.map((item) => <li key={item.message}><strong>{item.count}회</strong><span>{item.message}</span></li>)}</ol> : <div className="portfolio-state-panel">반복된 로그 메시지가 없습니다.</div>}</section><section className="advanced-panel"><header><h2>SQL 신호</h2><span>{analysis.sqlSignals.length}개</span></header>{analysis.sqlSignals.length > 0 ? <ul className="sql-signal-list">{analysis.sqlSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul> : <div className="portfolio-state-panel">SQL 관련 오류 문구가 없습니다.</div>}</section></div> : null}
      {view === "EXCEPTIONS" ? <div className="log-exception-grid"><section className="advanced-panel"><header><h2>Exception Chain</h2><span>{analysis.exceptions.length}개</span></header><ol className="exception-chain">{analysis.exceptions.map((exception, index) => <li className={exception === analysis.rootCause ? "root" : undefined} key={`${exception.lineNumber}:${index}`}><span>{exception.causedBy ? "Caused by" : "Exception"}</span><strong>{exception.type}</strong><p>{exception.message || "메시지 없음"}</p><small>line {exception.lineNumber}</small></li>)}</ol></section><section className="advanced-panel"><header><h2>Application Frames</h2><span>라이브러리 Frame 제외</span></header><div className="stack-frame-list">{analysis.stackFrames.filter((frame) => frame.applicationFrame).map((frame) => <article key={`${frame.lineNumber}:${frame.className}`}><code>{frame.className}.{frame.methodName}</code><span>{frame.fileName}{frame.sourceLine ? `:${frame.sourceLine}` : ""}</span><small>log line {frame.lineNumber}</small></article>)}</div><details><summary>전체 Stack Frame {analysis.stackFrames.length}개</summary><div className="stack-frame-list compact">{analysis.stackFrames.map((frame) => <article key={`${frame.lineNumber}:${frame.className}`}><code>{frame.className}.{frame.methodName}</code><span>{frame.fileName}{frame.sourceLine ? `:${frame.sourceLine}` : ""}</span></article>)}</div></details></section></div> : null}
      {view === "ENTRIES" ? <section className="advanced-panel log-entry-panel"><header><div><h2>Parsed Entries</h2><span>{visibleEntries.length}/{analysis.entries.length}</span></div><div className="advanced-filter-row"><input aria-label="로그 메시지 검색" value={query} placeholder="메시지·Logger 검색" onChange={(event) => setQuery(event.target.value)} /><select aria-label="로그 Level 필터" value={level} onChange={(event) => setLevel(event.target.value as "ALL" | LogLevel)}><option value="ALL">전체 Level</option>{(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL", "UNKNOWN"] as LogLevel[]).map((item) => <option key={item}>{item}</option>)}</select></div></header><div className="parsed-log-list">{visibleEntries.map((entry) => <article className={`level-${entry.level.toLowerCase()}`} key={entry.id}><span>{entry.lineNumber}</span><time>{entry.timestamp ?? "-"}</time><strong>{entry.level}</strong><code>{entry.logger ?? ""}</code><p>{entry.message}</p></article>)}</div></section> : null}
      {view === "REDACTED" ? <section className="advanced-panel redacted-log-panel"><header><div><h2>마스킹된 원문</h2><span>{analysis.sensitiveValueCount}개 민감 값 치환</span></div><button type="button" className="ghost-button" onClick={() => void copyText(analysis.redactedSource).then(() => applicationNotification.success("마스킹 로그를 복사했습니다."))}>복사</button></header><pre>{analysis.redactedSource}</pre></section> : null}
      <p className="utility-warning"><strong>업무 History 활용</strong> 분석 보고서를 복사하거나 다운로드한 뒤 Root Cause, 해결 방법, 재발 방지를 추가해 트러블슈팅 글로 정리하세요. 자동 분석 결과는 원본 로그와 코드로 다시 확인해야 합니다.</p>
      <UtilityHelpDialog isOpen={helpOpen} title="Log · Stack Trace Analyzer" description="긴 로그에서 원인 후보와 애플리케이션 코드를 빠르게 찾습니다." onClose={() => setHelpOpen(false)}><article><h3>분석 규칙</h3><p>로그 Level, Exception·Caused by, Java Stack Frame, SQL 오류 문구와 반복 메시지를 문자열 패턴으로 분석합니다.</p></article><article><h3>민감정보</h3><p>Authorization Bearer, JWT 형태, password·token·apiKey 값을 마스킹합니다. 완벽한 개인정보 탐지기가 아니므로 외부 공유 전 반드시 직접 검토하세요.</p></article><article><h3>Root Cause</h3><p>가장 마지막 Caused by를 우선 표시하지만, 실제 원인은 앞선 업무 상태나 데이터일 수 있습니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
