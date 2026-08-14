import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText } from "@/features/utility/utils/browserFileUtils";
import { buildCronExpression, describeCron, nextCronRuns, type CronDialect, type CronFields } from "@/features/utility/utils/cronUtils";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const initialFields: CronFields = { second: "0", minute: "*/10", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" };
const presets: Array<{ label: string; fields: CronFields }> = [
  { label: "10분마다", fields: initialFields },
  { label: "매일 오전 9시", fields: { second: "0", minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "*" } },
  { label: "평일 오전 9시", fields: { second: "0", minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1-5" } },
  { label: "매월 1일 자정", fields: { second: "0", minute: "0", hour: "0", dayOfMonth: "1", month: "*", dayOfWeek: "*" } },
];

export const CronGeneratorPage = () => {
  const [dialect, setDialect] = useState<CronDialect>("SPRING");
  const [fields, setFields] = useState(initialFields);
  const [helpOpen, setHelpOpen] = useState(false);
  const generated = useMemo(() => {
    try {
      const expression = buildCronExpression(dialect, fields);
      return { expression, description: describeCron(dialect, fields), runs: nextCronRuns(dialect, fields), error: "" };
    } catch (error) { return { expression: "", description: "", runs: [], error: error instanceof Error ? error.message : "Cron을 만들지 못했습니다." }; }
  }, [dialect, fields]);
  const update = (field: keyof CronFields, value: string): void => setFields((current) => ({ ...current, [field]: value }));
  const springCode = `@Scheduled(cron = "${generated.expression}", zone = "Asia/Seoul")\npublic void runTask() {\n    // 반복 작업\n}`;

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Scheduler" title="Cron Generator" description="Spring 6필드와 Linux 5필드를 구분해 Cron을 만들고 다음 실행 시간을 확인합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-toolbar"><div className="segmented-buttons" role="group" aria-label="Cron 종류"><button type="button" className={dialect === "SPRING" ? "active" : undefined} onClick={() => setDialect("SPRING")}>Spring 6필드</button><button type="button" className={dialect === "LINUX" ? "active" : undefined} onClick={() => setDialect("LINUX")}>Linux 5필드</button></div><span className="cron-timezone">브라우저 시간대: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
      <div className="cron-presets"><span>자주 쓰는 설정</span>{presets.map((preset) => <button type="button" className="ghost-button" key={preset.label} onClick={() => setFields(preset.fields)}>{preset.label}</button>)}</div>
      <section className="cron-field-panel"><div className="cron-field-grid">{dialect === "SPRING" ? <label><span>초</span><input value={fields.second} onChange={(event) => update("second", event.target.value)} /><small>0–59</small></label> : null}<label><span>분</span><input value={fields.minute} onChange={(event) => update("minute", event.target.value)} /><small>0–59</small></label><label><span>시</span><input value={fields.hour} onChange={(event) => update("hour", event.target.value)} /><small>0–23</small></label><label><span>일</span><input value={fields.dayOfMonth} onChange={(event) => update("dayOfMonth", event.target.value)} /><small>1–31</small></label><label><span>월</span><input value={fields.month} onChange={(event) => update("month", event.target.value)} /><small>1–12</small></label><label><span>요일</span><input value={fields.dayOfWeek} onChange={(event) => update("dayOfWeek", event.target.value)} /><small>0–6, 일요일=0</small></label></div></section>
      {generated.error ? <p className="field-error" role="alert">{generated.error}</p> : <div className="cron-result-grid"><section className="tool-result-card"><header><h2>Cron 표현식</h2><button type="button" className="ghost-button" onClick={() => void copyText(generated.expression).then(() => applicationNotification.success("Cron을 복사했습니다."))}>복사</button></header><code className="cron-expression">{generated.expression}</code><p>{generated.description}</p>{dialect === "SPRING" ? <><h3>@Scheduled 예제</h3><pre>{springCode}</pre></> : <p className="utility-warning">Linux Cron은 초 필드가 없으며 분 단위로 실행됩니다.</p>}</section><section className="tool-result-card"><header><h2>다음 실행 예정</h2></header>{generated.runs.length === 0 ? <div className="portfolio-state-panel">표현식 범위 안에서 다음 실행을 찾지 못했습니다.</div> : <ol className="cron-run-list">{generated.runs.map((date) => <li key={date.toISOString()}><time dateTime={date.toISOString()}>{date.toLocaleString("ko-KR")}</time></li>)}</ol>}</section></div>}
      <UtilityHelpDialog isOpen={helpOpen} title="Cron Generator" description="Cron 각 필드가 나타내는 반복 조건을 폼으로 분리합니다." onClose={() => setHelpOpen(false)}>
        <article><h3>필드 순서</h3><p>Spring: 초 분 시 일 월 요일 / Linux: 분 시 일 월 요일 순서입니다.</p></article>
        <article><h3>기본 문법</h3><ul><li><code>*</code>: 모든 값</li><li><code>*/10</code>: 10단위 간격</li><li><code>1-5</code>: 1부터 5 범위</li><li><code>1,3,5</code>: 지정 값 목록</li></ul></article>
        <article><h3>제한</h3><p>이 구현은 숫자, *, ?, 간격, 범위, 목록을 지원합니다. L, W, # 같은 고급 Quartz 문법은 지원한다고 표시하지 않습니다.</p></article>
      </UtilityHelpDialog>
    </section>
  );
};

