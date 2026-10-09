/**
 * SqlFormatterPage.tsx — SQL 전용 정리기 (dpriver Instant SQL Formatter의 기본 기능을 따른 화면)
 *
 * [화면 구성]
 *   왼쪽: SQL 입력 → 버튼(정리·압축·예제·초기화·결과를 입력으로) → 결과(복사·다운로드)
 *   오른쪽: 옵션(정렬 방식·대소문자·쉼표·목록·AND/OR·출력 형식·주석 형식)
 *   아래: 테이블·칼럼 코멘트(선택) — 넣으면 칼럼·테이블 줄 끝에 주석으로 붙는다
 *
 * [상태 설계]
 *   결과 글자는 State에 저장하지 않는다. "마지막으로 정리를 누른 SQL(lastRun)"만 저장하고,
 *   결과는 렌더링할 때 지금 옵션으로 계산한다(파생 값). 그래서 정리한 뒤 옵션을 바꾸면 결과가 바로 다시 그려지고,
 *   결과와 옵션이 어긋나는 일이 없다. 입력을 고치면 lastRun을 비워 예전 결과가 남지 않게 한다.
 *
 * 실제 변환: utils/sqlFormatter.ts(정리), sqlCommentDictionary.ts(코멘트 읽기), sqlCodeOutput.ts(Java 코드 출력)
 */
import { useState, type KeyboardEvent } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { minifySource } from "@/features/utility/utils/sourceFormatter";
import { convertSqlOutput, sqlOutputTargetLabels, type SqlOutputTarget } from "@/features/utility/utils/sqlCodeOutput";
import { countDictionaryEntries, parseSqlCommentDictionary } from "@/features/utility/utils/sqlCommentDictionary";
import {
  defaultSqlFormatOptions,
  formatSqlWithComments,
  SQL_INDENT_RANGE,
  type SqlCase,
  type SqlCommaPosition,
  type SqlCommentStyle,
  type SqlFormatOptions,
  type SqlLayout,
} from "@/features/utility/utils/sqlFormatter";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const exampleSql = "select u.id, u.name, count(o.id) as orders_count, sum(o.total) as revenue from users u left join orders o on o.user_id = u.id where u.created_at > '2024-01-01' and u.status in ('active','trial') group by u.id, u.name having count(o.id) > 5 order by revenue desc limit 50;";

const exampleComments = ["users 유저테이블", "users.id 유저아이디", "users.name 유저이름", "orders 주문테이블", "orders_count 주문수", "revenue 수익"].join("\n");

const commentPlaceholder = [
  "예) 한 줄에 하나씩 (공백 또는 탭 구분)",
  "users 유저테이블",
  "users.id 유저아이디",
  "orders_count 주문수   ← SELECT의 AS 별칭 이름도 가능",
  "",
  "CREATE TABLE ... COMMENT '...' 또는 COMMENT ON COLUMN ... IS '...'를 그대로 붙여 넣어도 됩니다.",
].join("\n");

const caseOptions: Array<{ value: SqlCase; label: string }> = [
  { value: "UPPER", label: "대문자" },
  { value: "LOWER", label: "소문자" },
  { value: "CAPITAL", label: "첫 글자만 대문자" },
  { value: "UNCHANGED", label: "그대로" },
];
const layoutOptions: Array<{ value: SqlLayout; label: string }> = [
  { value: "RIVER", label: "키워드 정렬 (dpriver 기본)" },
  { value: "INDENT", label: "들여쓰기 칸 수" },
];
const commaOptions: Array<{ value: SqlCommaPosition; label: string }> = [
  { value: "AFTER", label: "항목 뒤 (a,)" },
  { value: "BEFORE", label: "항목 앞 (,a)" },
  { value: "BEFORE_SPACE", label: "항목 앞 + 공백 (, a)" },
];
const commentStyleOptions: Array<{ value: SqlCommentStyle; label: string }> = [
  { value: "SQL", label: "SQL (-- 코멘트)" },
  { value: "MYBATIS", label: "MyBatis (/* 코멘트 */)" },
];
const outputTargets: SqlOutputTarget[] = ["SQL", "JAVA_STRING", "JAVA_STRING_BUILDER"];

/** select 값은 그냥 문자열이라, 우리가 아는 값일 때만 쓴다(타입 단언 없이 좁히기). */
const pickOption = <T extends string>(value: string, allowed: ReadonlyArray<{ value: T }>, fallback: T): T =>
  allowed.find((option) => option.value === value)?.value ?? fallback;

type FormatOptionsWithoutDictionary = Omit<SqlFormatOptions, "dictionary">;

export const SqlFormatterPage = () => {
  const [source, setSource] = useState(exampleSql);
  const [options, setOptions] = useState<FormatOptionsWithoutDictionary>(defaultSqlFormatOptions);
  const [outputTarget, setOutputTarget] = useState<SqlOutputTarget>("SQL");
  const [commentSource, setCommentSource] = useState("");
  // 마지막으로 실행한 동작과 그때의 입력. 결과는 이 값과 지금 옵션으로 계산한다.
  const [lastRun, setLastRun] = useState<{ mode: "FORMAT" | "MINIFY"; source: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const commentDictionary = parseSqlCommentDictionary(commentSource);
  const commentEntryCount = countDictionaryEntries(commentDictionary);
  const formatOptions: SqlFormatOptions = { ...options, dictionary: commentEntryCount > 0 ? commentDictionary : undefined };

  // ── 파생 값: 결과 ──────────────────────────────
  const resultSql = !lastRun ? "" : lastRun.mode === "FORMAT" ? formatSqlWithComments(lastRun.source, formatOptions).text : minifySource("SQL", lastRun.source);
  const result = convertSqlOutput(resultSql, outputTarget);

  const changeOption = <K extends keyof FormatOptionsWithoutDictionary>(key: K, value: FormatOptionsWithoutDictionary[K]): void =>
    setOptions((current) => ({ ...current, [key]: value }));
  const changeIndent = (amount: -1 | 1): void =>
    changeOption("indentSize", Math.min(SQL_INDENT_RANGE.max, Math.max(SQL_INDENT_RANGE.min, options.indentSize + amount)));

  const format = (): void => {
    if (!source.trim()) {
      applicationNotification.warning("정리할 SQL을 입력해 주세요.");
      return;
    }
    setLastRun({ mode: "FORMAT", source });
    const { addedCommentCount } = formatSqlWithComments(source, formatOptions);
    applicationNotification.success("SQL을 정리했습니다.", commentEntryCount > 0 ? `코멘트 주석 ${addedCommentCount}개를 붙였습니다.` : undefined);
  };
  const minify = (): void => {
    setLastRun({ mode: "MINIFY", source });
    applicationNotification.success("SQL을 한 줄로 압축했습니다.");
  };
  const changeSource = (nextSource: string): void => {
    setSource(nextSource);
    setLastRun(null); // 입력이 바뀌면 예전 결과는 지운다
  };
  /** Ctrl+Enter(맥은 Cmd+Enter)로 정리 — dpriver와 같은 단축키 */
  const handleSourceKeyDown = (keyboardEvent: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (keyboardEvent.key !== "Enter" || !(keyboardEvent.ctrlKey || keyboardEvent.metaKey)) return;
    keyboardEvent.preventDefault();
    format();
  };

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle
        kicker="Developer Utility · SQL Beautify"
        title="SQL Formatter"
        description="SQL을 키워드 정렬·들여쓰기로 정리하고, 테이블·칼럼 코멘트를 주석으로 붙이거나 Java 코드로 바꿉니다."
        onHelpOpen={() => setHelpOpen(true)}
      />
      <div className="sql-formatter-layout">
        <div className="sql-formatter-main">
          <label className="sql-formatter-field">
            <span>SQL 입력 <small>(Ctrl+Enter로 정리)</small></span>
            <textarea aria-label="정리할 SQL 입력" value={source} onChange={(event) => changeSource(event.target.value)} onKeyDown={handleSourceKeyDown} spellCheck={false} />
          </label>
          <div className="sql-formatter-actions">
            <button type="button" onClick={format}>정리하기</button>
            <button type="button" className="ghost-button" onClick={minify}>한 줄로 압축</button>
            <button type="button" className="ghost-button" onClick={() => { changeSource(exampleSql); setCommentSource(exampleComments); }}>예제</button>
            <button type="button" className="ghost-button" onClick={() => changeSource("")}>초기화</button>
            <button type="button" className="ghost-button" disabled={!resultSql} onClick={() => changeSource(resultSql)}>결과를 입력으로</button>
          </div>

          <details className="sql-formatter-comments" open={commentSource.trim() !== "" || undefined}>
            <summary>테이블·칼럼 코멘트 (선택){commentSource.trim() ? ` · 인식한 코멘트 ${commentEntryCount}개` : ""}</summary>
            <p>넣으면 SELECT 칼럼·FROM/JOIN 테이블·UPDATE SET 칼럼 줄 끝에 주석으로 붙입니다.</p>
            <textarea aria-label="테이블·칼럼 코멘트 입력" value={commentSource} onChange={(event) => setCommentSource(event.target.value)} placeholder={commentPlaceholder} spellCheck={false} />
          </details>

          <label className="sql-formatter-field">
            <span>결과</span>
            <textarea aria-label="정리 결과" value={result} readOnly spellCheck={false} placeholder="정리하기 또는 한 줄로 압축 결과가 여기에 나옵니다." />
          </label>
          <div className="utility-result-actions">
            <span>입력 {new Blob([source]).size.toLocaleString("ko-KR")} bytes → 결과 {new Blob([result]).size.toLocaleString("ko-KR")} bytes</span>
            <button type="button" className="ghost-button" disabled={!result} onClick={() => void copyText(result).then(() => applicationNotification.success("결과를 복사했습니다."))}>복사</button>
            <button type="button" className="ghost-button" disabled={!result} onClick={() => downloadText(outputTarget === "SQL" ? "formatted.sql" : "FormattedSql.java", result)}>다운로드</button>
          </div>
        </div>

        <aside className="sql-formatter-options" aria-label="SQL 정리 옵션">
          <fieldset>
            <legend>정렬</legend>
            <label>정렬 방식<select value={options.layout} onChange={(event) => changeOption("layout", pickOption(event.target.value, layoutOptions, "RIVER"))}>{layoutOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {options.layout === "INDENT" ? (
              // 들여쓰기: −/+ 버튼으로 1~10칸. output은 바뀐 값을 화면 낭독기에 알려 준다(aria-live).
              <div className="formatter-indent-stepper" role="group" aria-label="SQL 들여쓰기 칸 수">
                <span>들여쓰기</span>
                <button type="button" className="ghost-button" aria-label="들여쓰기 한 칸 줄이기" disabled={options.indentSize <= SQL_INDENT_RANGE.min} onClick={() => changeIndent(-1)}>−</button>
                <output aria-live="polite">{options.indentSize}칸</output>
                <button type="button" className="ghost-button" aria-label="들여쓰기 한 칸 늘리기" disabled={options.indentSize >= SQL_INDENT_RANGE.max} onClick={() => changeIndent(1)}>+</button>
              </div>
            ) : <p className="sql-formatter-hint">키워드를 7칸에 맞춰 FROM·WHERE 뒤 내용을 한 열로 세웁니다.</p>}
          </fieldset>
          <fieldset>
            <legend>대소문자</legend>
            <label>키워드<select value={options.keywordCase} onChange={(event) => changeOption("keywordCase", pickOption(event.target.value, caseOptions, "UPPER"))}>{caseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>함수<select value={options.functionCase} onChange={(event) => changeOption("functionCase", pickOption(event.target.value, caseOptions, "CAPITAL"))}>{caseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>테이블·칼럼 이름<select value={options.identifierCase} onChange={(event) => changeOption("identifierCase", pickOption(event.target.value, caseOptions, "UNCHANGED"))}>{caseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </fieldset>
          <fieldset>
            <legend>목록·조건</legend>
            <label>쉼표 위치<select value={options.commaPosition} onChange={(event) => changeOption("commaPosition", pickOption(event.target.value, commaOptions, "AFTER"))}>{commaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="checkbox-label"><input type="checkbox" checked={options.stackLists} onChange={(event) => changeOption("stackLists", event.target.checked)} />목록을 한 줄에 하나씩</label>
            <label className="checkbox-label"><input type="checkbox" checked={options.alignAliases} onChange={(event) => changeOption("alignAliases", event.target.checked)} />AS 별칭 열 맞춤</label>
            <label className="checkbox-label"><input type="checkbox" checked={options.logicalUnderKeyword} onChange={(event) => changeOption("logicalUnderKeyword", event.target.checked)} />AND/OR를 WHERE 아래에</label>
          </fieldset>
          <fieldset>
            <legend>출력</legend>
            <label>출력 형식<select value={outputTarget} onChange={(event) => setOutputTarget(outputTargets.find((target) => target === event.target.value) ?? "SQL")}>{outputTargets.map((target) => <option key={target} value={target}>{sqlOutputTargetLabels[target]}</option>)}</select></label>
            <label>주석 형식<select value={options.commentStyle} onChange={(event) => changeOption("commentStyle", pickOption(event.target.value, commentStyleOptions, "SQL"))}>{commentStyleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <button type="button" className="ghost-button" onClick={() => setOptions(defaultSqlFormatOptions)}>옵션 기본값으로</button>
          </fieldset>
        </aside>
      </div>

      <div className="utility-warning"><strong>정리 범위</strong> 학습용 경량 정리기입니다. SELECT·INSERT·UPDATE·DELETE, JOIN, 서브쿼리, CASE, UNION을 정리하며 MyBatis 동적 태그(&lt;if&gt; 등)와 프로시저 같은 DB별 문법은 정리하지 않습니다.</div>

      <UtilityHelpDialog isOpen={helpOpen} title="SQL Formatter" description="dpriver Instant SQL Formatter의 기본 기능을 브라우저 안에서 따라 만든 SQL 정리기입니다." onClose={() => setHelpOpen(false)}>
        <article>
          <h3>사용 방법</h3>
          <ol>
            <li>SQL을 입력하고 정리하기(또는 Ctrl+Enter)를 누릅니다.</li>
            <li>오른쪽 옵션을 바꾸면 결과가 바로 다시 정리됩니다.</li>
            <li>테이블·칼럼 코멘트를 넣으면 칼럼·테이블 줄 끝에 주석이 붙습니다. 쿼리를 바로 실행할 때는 SQL(--), MyBatis XML에 넣을 때는 MyBatis(/* */)를 고르세요.</li>
            <li>결과를 복사·다운로드하거나, 결과를 입력으로 옮겨 다시 다듬습니다.</li>
          </ol>
        </article>
        <article>
          <h3>옵션</h3>
          <p><strong>키워드 정렬</strong>은 SELECT·FROM·WHERE를 7칸에 맞춰 내용을 한 열로 세우고, <strong>들여쓰기 칸 수</strong>는 키워드 아래로 1~10칸 들입니다. 쉼표 위치, 목록을 한 줄에 하나씩, AS 별칭 열 맞춤, AND/OR 위치, 키워드·함수·이름 대소문자를 고를 수 있습니다.</p>
          <p>출력 형식을 Java로 바꾸면 줄마다 \n을 붙인 문자열(String +, StringBuilder)로 만들어 줍니다.</p>
        </article>
        <article>
          <h3>코멘트 주석</h3>
          <p>u.id처럼 별칭이 붙은 칼럼은 FROM·JOIN의 별칭(users u)으로 테이블을 찾아 users.id 코멘트를 붙입니다. AS 별칭 이름(orders_count)을 코멘트에 넣으면 그 코멘트가 먼저 쓰입니다. 원래 쿼리에 있던 주석은 그대로 두므로 다시 정리해도 두 번 붙지 않습니다. MyBatis XML은 줄이 합쳐지면 -- 뒤 쿼리가 모두 주석이 될 수 있어 /* */가 안전합니다.</p>
        </article>
        <article>
          <h3>학습 포인트</h3>
          <p>결과를 State에 저장하지 않고 "마지막 입력 + 지금 옵션"으로 계산하는 파생 값 패턴, 그리고 SQL을 토큰(문자열·주석·괄호)으로 나눈 뒤 서브쿼리를 재귀로 정리하는 방법을 볼 수 있습니다.</p>
        </article>
      </UtilityHelpDialog>
    </section>
  );
};
