/**
 * SqlFormatterPage.tsx — SQL 전용 정리기 (dpriver Instant SQL Formatter의 기본 기능을 따른 화면)
 *
 * [화면 구성] 위에서 아래로
 *   SQL 입력 → 옵션 표(이름|버튼|이름|버튼, 입력 폼처럼) → 버튼(정리·압축·예제·초기화·결과를 입력으로·옵션 기본값)
 *   → 테이블·칼럼 코멘트(선택) → 결과(복사·다운로드)
 *
 * [옵션 버튼 묶음]
 *   여러 값 중 하나를 고르는 옵션은 select 대신 버튼 묶음(segmented-buttons)으로 보여 준다. 고른 버튼만 밝게 칠한다.
 *   켜고 끄는 옵션(목록 한 줄에 하나 등)은 버튼 하나가 켜졌을 때 밝아지는 토글 버튼이다.
 *   aria-pressed: 화면 낭독기에 "눌림(선택됨)" 상태를 알린다(색만으로 상태를 알리지 않기 위해).
 *
 * [상태 설계]
 *   결과 글자는 State에 저장하지 않고, 렌더링할 때 "지금 입력 + 옵션 + 결과 방식(정리/압축)"으로 계산한다(파생 값).
 *   그래서 입력칸에 글자를 칠 때마다(onChange) 결과가 바로 바뀌고, 옵션을 눌러도 바로 다시 정리된다.
 *   ★ keyup이 아니라 onChange: 마우스 붙여넣기·한글 조합 입력·자동 완성은 keyup이 오지 않거나 늦다.
 *   ★ useDeferredValue: 긴 SQL을 붙여 넣어 정리가 무거워져도 입력칸은 먼저 반응하고 결과는 뒤따라 계산한다.
 *
 * 실제 변환: utils/sqlFormatter.ts(정리), sqlCommentDictionary.ts(코멘트 읽기), sqlCodeOutput.ts(Java 코드 출력)
 */
import { useDeferredValue, useId, useState, type ReactNode } from "react";
import { HighlightedTextarea } from "@/shared/ui/HighlightedTextarea";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { minifySource } from "@/features/utility/utils/sourceFormatter";
import { convertSqlOutput, sqlOutputTargetLabels, type SqlOutputTarget } from "@/features/utility/utils/sqlCodeOutput";
import { countDictionaryEntries, parseSqlCommentDictionary } from "@/features/utility/utils/sqlCommentDictionary";
import { complexExampleComments, complexExampleSql } from "@/features/utility/utils/sqlFormatterExamples";
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

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

const caseOptions: Array<ChoiceOption<SqlCase>> = [
  { value: "UPPER", label: "대문자" },
  { value: "LOWER", label: "소문자" },
  { value: "CAPITAL", label: "첫 글자만" },
  { value: "UNCHANGED", label: "그대로" },
];
const layoutOptions: Array<ChoiceOption<SqlLayout>> = [
  { value: "RIVER", label: "키워드 정렬" },
  { value: "INDENT", label: "들여쓰기" },
];
const commaOptions: Array<ChoiceOption<SqlCommaPosition>> = [
  { value: "AFTER", label: "뒤 a," },
  { value: "BEFORE", label: "앞 ,a" },
  { value: "BEFORE_SPACE", label: "앞 , a" },
];
const commentStyleOptions: Array<ChoiceOption<SqlCommentStyle>> = [
  { value: "SQL", label: "SQL --" },
  { value: "MYBATIS", label: "MyBatis /* */" },
];
const outputOptions: Array<ChoiceOption<SqlOutputTarget>> = (["SQL", "JAVA_STRING", "JAVA_STRING_BUILDER"] as const).map((target) => ({ value: target, label: sqlOutputTargetLabels[target] }));

/**
 * 옵션 한 칸: 왼쪽 이름 칸 + 오른쪽 버튼 칸(입력 폼 표처럼).
 * 두 칸을 Fragment로 돌려줘서 바깥 CSS grid(이름|버튼|이름|버튼)의 칸이 되게 한다.
 * aria-labelledby: 버튼 묶음(group)의 이름을 왼쪽 이름 칸 글자로 연결한다.
 */
function OptionField({ label, children }: { label: string; children: (labelId: string) => ReactNode }) {
  const labelId = useId();
  return (
    <>
      <span className="sql-formatter-option-label" id={labelId}>{label}</span>
      <div className="sql-formatter-option-control">{children(labelId)}</div>
    </>
  );
}

/** 여러 값 중 하나를 고르는 버튼 묶음. 고른 버튼만 밝게(active) 칠한다. */
function ChoiceButtons<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<ChoiceOption<T>>; onChange: (value: T) => void }) {
  return (
    <OptionField label={label}>
      {(labelId) => (
        <div className="segmented-buttons" role="group" aria-labelledby={labelId}>
          {options.map((option) => (
            <button type="button" key={option.value} className={option.value === value ? "active" : undefined} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </OptionField>
  );
}

/** 켜고 끄는 토글 버튼. 켜져 있으면 밝게(active) 칠한다. */
function ToggleButton({ label, pressed, onChange }: { label: string; pressed: boolean; onChange: (pressed: boolean) => void }) {
  return (
    <button type="button" className={pressed ? "active" : undefined} aria-pressed={pressed} onClick={() => onChange(!pressed)}>
      {label}
    </button>
  );
}

type FormatOptionsWithoutDictionary = Omit<SqlFormatOptions, "dictionary">;
type ResultMode = "FORMAT" | "MINIFY";

export const SqlFormatterPage = () => {
  const [source, setSource] = useState(exampleSql);
  const [options, setOptions] = useState<FormatOptionsWithoutDictionary>(defaultSqlFormatOptions);
  const [outputTarget, setOutputTarget] = useState<SqlOutputTarget>("SQL");
  const [commentSource, setCommentSource] = useState("");
  const [resultMode, setResultMode] = useState<ResultMode>("FORMAT");
  const [helpOpen, setHelpOpen] = useState(false);

  const commentDictionary = parseSqlCommentDictionary(commentSource);
  const commentEntryCount = countDictionaryEntries(commentDictionary);
  const formatOptions: SqlFormatOptions = { ...options, dictionary: commentEntryCount > 0 ? commentDictionary : undefined };

  // ── 파생 값: 결과(입력하면 바로 계산) ──────────────────────────────
  // 입력칸은 source로 바로 그리고, 결과는 한 박자 늦어도 되는 deferredSource로 계산한다.
  const deferredSource = useDeferredValue(source);
  const formatted = resultMode === "FORMAT" ? formatSqlWithComments(deferredSource, formatOptions) : { text: minifySource("SQL", deferredSource), addedCommentCount: 0 };
  const resultSql = formatted.text;
  const result = convertSqlOutput(resultSql, outputTarget);

  const changeOption = <K extends keyof FormatOptionsWithoutDictionary>(key: K, value: FormatOptionsWithoutDictionary[K]): void =>
    setOptions((current) => ({ ...current, [key]: value }));
  const changeIndent = (amount: -1 | 1): void =>
    changeOption("indentSize", Math.min(SQL_INDENT_RANGE.max, Math.max(SQL_INDENT_RANGE.min, options.indentSize + amount)));


  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle
        kicker="Developer Utility · SQL Beautify"
        title="SQL Formatter"
        description="SQL을 키워드 정렬·들여쓰기로 정리하고, 테이블·칼럼 코멘트를 주석으로 붙이거나 Java 코드로 바꿉니다."
        onHelpOpen={() => setHelpOpen(true)}
      />
      <div className="sql-formatter-main">
        <label className="sql-formatter-field">
          <span>SQL 입력 <small>(입력하면 아래 결과에 바로 정리됩니다)</small></span>
          <HighlightedTextarea language="sql" aria-label="정리할 SQL 입력" value={source} onChange={(event) => setSource(event.target.value)} />
        </label>

        {/* 옵션 표: 넓은 화면은 "이름|버튼|이름|버튼" 두 쌍씩 4줄, 좁은 화면은 한 쌍씩 */}
        <div className="sql-formatter-options" role="group" aria-label="SQL 정리 옵션">
          <OptionField label="정렬 방식">
            {(labelId) => (
              <>
                <div className="segmented-buttons" role="group" aria-labelledby={labelId}>
                  {layoutOptions.map((option) => (
                    <button type="button" key={option.value} className={option.value === options.layout ? "active" : undefined} aria-pressed={option.value === options.layout} onClick={() => changeOption("layout", option.value)}>{option.label}</button>
                  ))}
                </div>
                {options.layout === "INDENT" ? (
                  // 들여쓰기: −/+ 버튼으로 1~10칸. output은 바뀐 값을 화면 낭독기에 알려 준다(aria-live).
                  <div className="formatter-indent-stepper" role="group" aria-label="SQL 들여쓰기 칸 수">
                    <button type="button" className="ghost-button" aria-label="들여쓰기 한 칸 줄이기" disabled={options.indentSize <= SQL_INDENT_RANGE.min} onClick={() => changeIndent(-1)}>−</button>
                    <output aria-live="polite">{options.indentSize}칸</output>
                    <button type="button" className="ghost-button" aria-label="들여쓰기 한 칸 늘리기" disabled={options.indentSize >= SQL_INDENT_RANGE.max} onClick={() => changeIndent(1)}>+</button>
                  </div>
                ) : null}
              </>
            )}
          </OptionField>
          <ChoiceButtons label="출력 형식" value={outputTarget} options={outputOptions} onChange={setOutputTarget} />
          <ChoiceButtons label="키워드" value={options.keywordCase} options={caseOptions} onChange={(value) => changeOption("keywordCase", value)} />
          <ChoiceButtons label="쉼표 위치" value={options.commaPosition} options={commaOptions} onChange={(value) => changeOption("commaPosition", value)} />
          <ChoiceButtons label="함수" value={options.functionCase} options={caseOptions} onChange={(value) => changeOption("functionCase", value)} />
          <OptionField label="목록·조건">
            {(labelId) => (
              <div className="segmented-buttons" role="group" aria-labelledby={labelId}>
                <ToggleButton label="한 줄에 하나" pressed={options.stackLists} onChange={(pressed) => changeOption("stackLists", pressed)} />
                <ToggleButton label="AS 별칭 맞춤" pressed={options.alignAliases} onChange={(pressed) => changeOption("alignAliases", pressed)} />
                <ToggleButton label="AND/OR를 WHERE 아래에" pressed={options.logicalUnderKeyword} onChange={(pressed) => changeOption("logicalUnderKeyword", pressed)} />
              </div>
            )}
          </OptionField>
          <ChoiceButtons label="테이블·칼럼 이름" value={options.identifierCase} options={caseOptions} onChange={(value) => changeOption("identifierCase", value)} />
          <ChoiceButtons label="주석 형식" value={options.commentStyle} options={commentStyleOptions} onChange={(value) => changeOption("commentStyle", value)} />
        </div>

        <div className="sql-formatter-actions">
          {/* 결과 방식: 고른 버튼만 밝게. 입력하면 고른 방식으로 바로 결과가 나온다. */}
          <div className="segmented-buttons" role="group" aria-label="결과 방식">
            <button type="button" className={resultMode === "FORMAT" ? "active" : undefined} aria-pressed={resultMode === "FORMAT"} onClick={() => setResultMode("FORMAT")}>정리</button>
            <button type="button" className={resultMode === "MINIFY" ? "active" : undefined} aria-pressed={resultMode === "MINIFY"} onClick={() => setResultMode("MINIFY")}>한 줄로 압축</button>
          </div>
          <button type="button" className="ghost-button" onClick={() => { setSource(exampleSql); setCommentSource(exampleComments); }}>예제</button>
          {/* CTE·서브쿼리·CASE·JOIN·EXISTS·UPDATE + CREATE TABLE 코멘트를 한 번에 시험(sqlFormatterExamples.ts) */}
          <button type="button" className="ghost-button" onClick={() => { setSource(complexExampleSql); setCommentSource(complexExampleComments); }}>복잡한 예제</button>
          <button type="button" className="ghost-button" onClick={() => setSource("")}>초기화</button>
          <button type="button" className="ghost-button" disabled={!resultSql} onClick={() => setSource(resultSql)}>결과를 입력으로</button>
          {/* 결과 칸 아래까지 내려가지 않고 바로 복사(출력 형식이 Java면 Java 코드를 복사) */}
          <button type="button" className="ghost-button" disabled={!result} onClick={() => void copyText(result).then(() => applicationNotification.success("결과를 복사했습니다."))}>결과 복사</button>
          <button type="button" className="ghost-button sql-formatter-reset" onClick={() => setOptions(defaultSqlFormatOptions)}>옵션 기본값으로</button>
        </div>

        <details className="sql-formatter-comments" open={commentSource.trim() !== "" || undefined}>
          <summary>테이블·칼럼 코멘트 (선택){commentSource.trim() ? ` · 인식한 코멘트 ${commentEntryCount}개` : ""}</summary>
          <p>넣으면 SELECT 칼럼·FROM/JOIN 테이블·UPDATE SET 칼럼 줄 끝에 주석으로 붙입니다.</p>
          <textarea aria-label="테이블·칼럼 코멘트 입력" value={commentSource} onChange={(event) => setCommentSource(event.target.value)} placeholder={commentPlaceholder} spellCheck={false} />
        </details>

        <label className="sql-formatter-field">
          <span>결과</span>
          {/* 결과가 Java 코드면 Java 색, SQL이면 SQL 색 */}
          <HighlightedTextarea language={outputTarget === "SQL" ? "sql" : "java"} aria-label="정리 결과" value={result} readOnly placeholder="입력하면 여기에 바로 정리 결과가 나옵니다." />
        </label>
        <div className="utility-result-actions">
          <span>
            입력 {new Blob([source]).size.toLocaleString("ko-KR")} bytes → 결과 {new Blob([result]).size.toLocaleString("ko-KR")} bytes
            {/* 알림 창 대신 여기 글자로: 입력할 때마다 알림이 뜨면 방해되므로 */}
            {commentEntryCount > 0 && resultMode === "FORMAT" && resultSql ? ` · 코멘트 주석 ${formatted.addedCommentCount}개` : ""}
          </span>
          <button type="button" className="ghost-button" disabled={!result} onClick={() => void copyText(result).then(() => applicationNotification.success("결과를 복사했습니다."))}>복사</button>
          <button type="button" className="ghost-button" disabled={!result} onClick={() => downloadText(outputTarget === "SQL" ? "formatted.sql" : "FormattedSql.java", result)}>다운로드</button>
        </div>
      </div>

      <div className="utility-warning"><strong>정리 범위</strong> 학습용 경량 정리기입니다. SELECT·INSERT·UPDATE·DELETE, JOIN, 서브쿼리, CASE, UNION을 정리하며 MyBatis 동적 태그(&lt;if&gt; 등)와 프로시저 같은 DB별 문법은 정리하지 않습니다.</div>

      <UtilityHelpDialog isOpen={helpOpen} title="SQL Formatter" description="dpriver Instant SQL Formatter의 기본 기능을 브라우저 안에서 따라 만든 SQL 정리기입니다." onClose={() => setHelpOpen(false)}>
        <article>
          <h3>사용 방법</h3>
          <ol>
            <li>SQL을 입력하면 아래 결과에 바로 정리됩니다(정리 버튼이 필요 없습니다).</li>
            <li>옵션·결과 방식(정리/한 줄로 압축) 버튼을 누르면 결과가 바로 다시 정리됩니다. 고른 버튼이 밝게 표시됩니다.</li>
            <li>테이블·칼럼 코멘트를 넣으면 칼럼·테이블 줄 끝에 주석이 붙습니다. 쿼리를 바로 실행할 때는 SQL(--), MyBatis XML에 넣을 때는 MyBatis(/* */)를 고르세요.</li>
            <li>결과를 복사·다운로드하거나, 결과를 입력으로 옮겨 다시 다듬습니다.</li>
          </ol>
        </article>
        <article>
          <h3>옵션</h3>
          <p><strong>키워드 정렬</strong>은 SELECT·FROM·WHERE를 7칸에 맞춰 내용을 한 열로 세우고, <strong>들여쓰기</strong>는 키워드 아래로 1~10칸 들입니다. 쉼표 위치, 목록을 한 줄에 하나씩, AS 별칭 열 맞춤, AND/OR 위치, 키워드·함수·이름 대소문자를 고를 수 있습니다.</p>
          <p>출력 형식을 Java로 바꾸면 줄마다 \n을 붙인 문자열(String +, StringBuilder)로 만들어 줍니다.</p>
        </article>
        <article>
          <h3>코멘트 주석</h3>
          <p>u.id처럼 별칭이 붙은 칼럼은 FROM·JOIN의 별칭(users u)으로 테이블을 찾아 users.id 코멘트를 붙입니다. AS 별칭 이름(orders_count)을 코멘트에 넣으면 그 코멘트가 먼저 쓰입니다. 원래 쿼리에 있던 주석은 그대로 두므로 다시 정리해도 두 번 붙지 않습니다. MyBatis XML은 줄이 합쳐지면 -- 뒤 쿼리가 모두 주석이 될 수 있어 /* */가 안전합니다.</p>
        </article>
        <article>
          <h3>학습 포인트</h3>
          <p>결과를 State에 저장하지 않고 "지금 입력 + 옵션"으로 바로 계산하는 파생 값 패턴과 입력이 버벅이지 않게 하는 useDeferredValue, 그리고 SQL을 토큰(문자열·주석·괄호)으로 나눈 뒤 서브쿼리를 재귀로 정리하는 방법을 볼 수 있습니다.</p>
        </article>
      </UtilityHelpDialog>
    </section>
  );
};
