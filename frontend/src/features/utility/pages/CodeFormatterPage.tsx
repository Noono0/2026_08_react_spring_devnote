// CodeFormatterPage.tsx — 코드 정렬(들여쓰기 정리)·압축(공백 제거) 도구. 실제 변환은 utils/sourceFormatter.ts가 한다.
// SQL은 들여쓰기 칸 수(1~10)를 −/+로 고르고, "테이블·칼럼 코멘트"를 넣으면 칼럼·테이블 줄 끝에 주석을 붙인다(utils/sqlFormatter.ts).

import { useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { defaultFormatterOptions, formatSource, minifySource, type FormatterLanguage, type FormatterOptions } from "@/features/utility/utils/sourceFormatter";
import { countDictionaryEntries, parseSqlCommentDictionary } from "@/features/utility/utils/sqlCommentDictionary";
import { formatSqlWithComments, SQL_INDENT_RANGE } from "@/features/utility/utils/sqlFormatter";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const languageLabels: Array<{ value: FormatterLanguage; label: string; extension: string }> = [
  { value: "JSON", label: "JSON", extension: "json" }, { value: "JAVASCRIPT", label: "JavaScript", extension: "js" },
  { value: "TYPESCRIPT", label: "TypeScript", extension: "ts" }, { value: "CSS", label: "CSS", extension: "css" },
  { value: "HTML", label: "HTML", extension: "html" }, { value: "SQL", label: "SQL", extension: "sql" },
  { value: "MARKDOWN", label: "Markdown", extension: "md" },
];

const examples: Record<FormatterLanguage, string> = {
  JSON: '{"name":"DevNote","features":["portfolio","react","utilities"]}',
  JAVASCRIPT: 'const greet=(name)=>{const message="Hello "+name;console.log(message);};greet("DevNote");',
  TYPESCRIPT: 'interface User {id:number;name:string;}const user:User={id:1,name:"DevNote"};',
  CSS: '.card{display:flex;gap:12px;color:#172033}.card:hover{transform:translateY(-2px)}',
  HTML: '<main><section><h1>DevNote</h1><p>Developer utilities</p></section></main>',
  SQL: "select m.member_id,m.member_name from members m left join polls p on p.created_by=m.member_id where m.use_yn='Y' order by m.member_id desc",
  MARKDOWN: "# DevNote\n\n- React\n- Spring Boot\n\n**개발 유틸리티** 문서입니다.",
};

/** 코멘트 입력칸 안내. 위 SQL 예제의 테이블·칼럼 이름을 써서 바로 따라 해 볼 수 있게 했다. */
const sqlCommentPlaceholder = [
  "예) 한 줄에 하나씩 (공백 또는 탭 구분)",
  "members 회원테이블",
  "members.member_id 회원아이디",
  "members.member_name 회원이름",
  "orders_count 주문수   ← SELECT의 AS 별칭 이름도 가능",
  "",
  "CREATE TABLE ... COMMENT '...' 또는 COMMENT ON COLUMN ... IS '...'를 그대로 붙여 넣어도 됩니다.",
].join("\n");

export const CodeFormatterPage = () => {
  const [language, setLanguage] = useState<FormatterLanguage>("JSON");
  const [source, setSource] = useState(examples.JSON);
  const [result, setResult] = useState("");
  const [options, setOptions] = useState<FormatterOptions>(defaultFormatterOptions);
  const [sqlCommentSource, setSqlCommentSource] = useState(""); // 테이블·칼럼 코멘트 입력(SQL 전용)
  const [errorMessage, setErrorMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  // 코멘트 입력을 읽은 사전. 입력이 바뀔 때마다 다시 읽어 "인식한 코멘트 수"를 바로 보여 준다.
  const sqlCommentDictionary = parseSqlCommentDictionary(sqlCommentSource);
  const sqlCommentEntryCount = countDictionaryEntries(sqlCommentDictionary);

  /** SQL 정리. 코멘트 입력이 있으면 사전을 넘겨 주석을 붙이고, 붙인 개수를 알림 설명으로 돌려준다. */
  const formatSqlSource = (): { text: string; description?: string } => {
    const { text, addedCommentCount } = formatSqlWithComments(source, {
      indentSize: options.sqlIndentSize,
      uppercase: options.sqlUppercase,
      commentStyle: options.sqlCommentStyle,
      dictionary: sqlCommentEntryCount > 0 ? sqlCommentDictionary : undefined,
    });
    return { text, description: sqlCommentEntryCount > 0 ? `코멘트 주석 ${addedCommentCount}개를 붙였습니다.` : undefined };
  };

  // 정렬 또는 압축 실행. 문법 오류 등으로 실패하면 결과 대신 오류 문구를 보여 준다.
  const run = (operation: "FORMAT" | "MINIFY"): void => {
    try {
      if (operation === "MINIFY") {
        setResult(minifySource(language, source));
        applicationNotification.success("소스를 압축했습니다.");
      } else {
        const formatted = language === "SQL" ? formatSqlSource() : { text: formatSource(language, source, options), description: undefined };
        setResult(formatted.text);
        applicationNotification.success("소스를 정리했습니다.", formatted.description);
      }
      setErrorMessage("");
    } catch (error) {
      setResult("");
      setErrorMessage(error instanceof Error ? error.message : "입력 문법을 확인해 주세요.");
    }
  };
  const changeLanguage = (nextLanguage: FormatterLanguage): void => { setLanguage(nextLanguage); setSource(examples[nextLanguage]); setResult(""); setErrorMessage(""); };
  const extension = languageLabels.find((item) => item.value === language)?.extension ?? "txt";
  /** SQL 들여쓰기 칸 수를 1~10 안에서 한 칸씩 바꾼다. */
  const changeSqlIndent = (amount: -1 | 1): void => setOptions((current) => ({
    ...current,
    sqlIndentSize: Math.min(SQL_INDENT_RANGE.max, Math.max(SQL_INDENT_RANGE.min, current.sqlIndentSize + amount)),
  }));

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Beautify" title="Code Formatter" description="JSON·JavaScript·TypeScript·CSS·HTML·SQL·Markdown을 브라우저에서 정리하거나 압축합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-toolbar formatter-toolbar">
        <label>언어<select value={language} onChange={(event) => changeLanguage(event.target.value as FormatterLanguage)}>{languageLabels.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        {language === "SQL" ? (
          // SQL 들여쓰기: −/+ 버튼으로 1~10칸. output은 바뀐 값을 화면 낭독기에 알려 준다(aria-live).
          <div className="formatter-indent-stepper" role="group" aria-label="SQL 들여쓰기 칸 수">
            <span>들여쓰기</span>
            <button type="button" className="ghost-button" aria-label="들여쓰기 한 칸 줄이기" disabled={options.sqlIndentSize <= SQL_INDENT_RANGE.min} onClick={() => changeSqlIndent(-1)}>−</button>
            <output aria-live="polite">{options.sqlIndentSize}칸</output>
            <button type="button" className="ghost-button" aria-label="들여쓰기 한 칸 늘리기" disabled={options.sqlIndentSize >= SQL_INDENT_RANGE.max} onClick={() => changeSqlIndent(1)}>+</button>
          </div>
        ) : (
          <label>들여쓰기<select value={options.tabSize} onChange={(event) => setOptions((current) => ({ ...current, tabSize: Number(event.target.value) as 2 | 4 }))}><option value={2}>2칸</option><option value={4}>4칸</option></select></label>
        )}
        {language === "JAVASCRIPT" || language === "TYPESCRIPT" ? <><label>따옴표<select value={options.quoteStyle} onChange={(event) => setOptions((current) => ({ ...current, quoteStyle: event.target.value as FormatterOptions["quoteStyle"] }))}><option value="DOUBLE">큰따옴표</option><option value="SINGLE">작은따옴표</option></select></label><label className="checkbox-label"><input type="checkbox" checked={options.semicolons} onChange={(event) => setOptions((current) => ({ ...current, semicolons: event.target.checked }))} />세미콜론</label></> : null}
        {language === "SQL" ? (
          <>
            <label className="checkbox-label"><input type="checkbox" checked={options.sqlUppercase} onChange={(event) => setOptions((current) => ({ ...current, sqlUppercase: event.target.checked }))} />키워드 대문자</label>
            <label>
              주석 형식
              <select value={options.sqlCommentStyle} onChange={(event) => setOptions((current) => ({ ...current, sqlCommentStyle: event.target.value === "MYBATIS" ? "MYBATIS" : "SQL" }))}>
                <option value="SQL">SQL (-- 코멘트)</option>
                <option value="MYBATIS">MyBatis (/* 코멘트 */)</option>
              </select>
            </label>
          </>
        ) : null}
        <button type="button" onClick={() => run("FORMAT")}>정리하기</button><button type="button" className="ghost-button" onClick={() => run("MINIFY")}>Minify</button><button type="button" className="ghost-button" onClick={() => { setSource(""); setResult(""); setErrorMessage(""); }}>초기화</button>
      </div>
      {language === "SQL" ? (
        <label className="formatter-comment-source">
          <span>테이블·칼럼 코멘트 (선택) — 넣으면 SELECT 칼럼·테이블 줄 끝에 주석으로 붙입니다{sqlCommentSource.trim() ? ` · 인식한 코멘트 ${sqlCommentEntryCount}개` : ""}</span>
          <textarea aria-label="테이블·칼럼 코멘트 입력" value={sqlCommentSource} onChange={(event) => setSqlCommentSource(event.target.value)} placeholder={sqlCommentPlaceholder} spellCheck={false} />
        </label>
      ) : null}
      <div className="utility-editor-grid"><label><span>입력</span><textarea aria-label="포맷할 소스 입력" value={source} onChange={(event) => { setSource(event.target.value); setResult(""); }} spellCheck={false} /></label><label><span>결과</span><textarea aria-label="포맷 결과" value={result} readOnly spellCheck={false} placeholder="정리 또는 Minify 결과" /></label></div>
      {errorMessage ? <p className="field-error" role="alert">문법 오류: {errorMessage}</p> : null}
      <div className="utility-result-actions"><span>입력 {new Blob([source]).size.toLocaleString("ko-KR")} bytes → 결과 {new Blob([result]).size.toLocaleString("ko-KR")} bytes</span><button type="button" className="ghost-button" disabled={!result} onClick={() => void copyText(result).then(() => applicationNotification.success("결과를 복사했습니다."))}>복사</button><button type="button" className="ghost-button" disabled={!result} onClick={() => downloadText(`formatted.${extension}`, result)}>다운로드</button></div>
      <div className="utility-warning"><strong>Formatter 범위</strong> JSON은 실제 파서로 검증합니다. 그 외 언어는 학습용 경량 정리기이므로 복잡한 Template Literal, JSX, CSS 함수, SQL dialect의 완전한 AST 포맷팅은 지원하지 않습니다. SQL은 괄호 안(서브쿼리)을 한 줄로 두고, MyBatis 동적 태그(&lt;if&gt; 등)는 정리하지 않습니다.</div>
      <UtilityHelpDialog isOpen={helpOpen} title="Code Formatter" description="언어별로 흩어진 Source Formatting과 Code Beautify를 한 화면으로 통합했습니다." onClose={() => setHelpOpen(false)}><article><h3>사용 방법</h3><ol><li>언어를 선택하고 소스를 입력합니다.</li><li>들여쓰기와 언어별 옵션을 정합니다. SQL은 −/+로 1~10칸을 고릅니다.</li><li>SQL은 테이블·칼럼 코멘트를 넣으면 SELECT 칼럼·테이블 줄 끝에 주석을 붙입니다. 쿼리를 그대로 실행할 때는 SQL(--), MyBatis XML에 넣을 때는 MyBatis(/* */) 형식을 고르세요.</li><li>정리 또는 Minify를 실행합니다.</li><li>결과를 복사하거나 확장자에 맞춰 다운로드합니다.</li></ol></article><article><h3>SQL 코멘트 주석</h3><p>u.id처럼 별칭이 붙은 칼럼은 FROM·JOIN의 별칭(users u)으로 테이블을 찾아 users.id 코멘트를 붙입니다. AS 별칭 이름(orders_count)을 코멘트에 넣으면 그 코멘트가 먼저 쓰입니다. 원래 쿼리에 있던 주석은 그대로 두므로 결과를 다시 정리해도 두 번 붙지 않습니다.</p><p>MyBatis XML은 쿼리 줄이 합쳐지면 -- 뒤 쿼리가 모두 주석이 될 수 있어 /* */ 형식이 안전합니다.</p></article><article><h3>학습 포인트</h3><p>JSON처럼 문법 파서가 있는 형식과 단순 문자열 정규화의 정확도 차이, 옵션 상태와 오류 상태 처리를 비교할 수 있습니다. SQL은 먼저 토큰(문자열·주석·괄호)으로 나눠 키워드를 안전하게 찾는 방법을 보여 줍니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
