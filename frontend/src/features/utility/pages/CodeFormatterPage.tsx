// CodeFormatterPage.tsx — 코드 정렬(들여쓰기 정리)·압축(공백 제거) 도구. 실제 변환은 utils/sourceFormatter.ts가 한다.
// SQL의 세부 옵션(정렬 방식·들여쓰기·대소문자·코멘트 주석·Java 출력)은 SQL 전용 화면(SqlFormatterPage)에 있다.
//
// [입력하면 바로 결과]
//   결과를 State에 저장하지 않고, 렌더링할 때 "지금 입력 + 언어 + 옵션 + 모드(정리/압축)"로 계산한다(파생 값).
//   그래서 글자를 칠 때마다(onChange) 결과가 바로 바뀌고, 버튼을 누를 필요가 없다.
//   ★ keyup이 아니라 onChange를 쓰는 이유: 마우스로 붙여넣기·한글 조합 입력·자동 완성은 keyup이 오지 않거나 늦다.
//   ★ useDeferredValue: 긴 글을 붙여 넣어 정리가 무거워져도 입력칸은 먼저 바로 반응하고,
//     결과 계산은 React가 한가할 때 뒤따라 한다(입력이 버벅이지 않게).

import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { HighlightedTextarea } from "@/shared/ui/HighlightedTextarea";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { defaultFormatterOptions, formatSource, minifySource, type FormatterLanguage, type FormatterOptions } from "@/features/utility/utils/sourceFormatter";
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

type ResultMode = "FORMAT" | "MINIFY";

/** 지금 입력으로 결과를 계산한다. JSON 문법 오류 등은 결과 대신 오류 문구로 돌려준다. */
const computeResult = (mode: ResultMode, language: FormatterLanguage, source: string, options: FormatterOptions): { result: string; errorMessage: string } => {
  try {
    return { result: mode === "FORMAT" ? formatSource(language, source, options) : minifySource(language, source), errorMessage: "" };
  } catch (error) {
    return { result: "", errorMessage: error instanceof Error ? error.message : "입력 문법을 확인해 주세요." };
  }
};

export const CodeFormatterPage = () => {
  const [language, setLanguage] = useState<FormatterLanguage>("JSON");
  const [source, setSource] = useState(examples.JSON);
  const [options, setOptions] = useState<FormatterOptions>(defaultFormatterOptions);
  const [mode, setMode] = useState<ResultMode>("FORMAT");
  const [helpOpen, setHelpOpen] = useState(false);

  // 입력칸은 source로 바로 그리고, 결과는 한 박자 늦어도 되는 deferredSource로 계산한다.
  const deferredSource = useDeferredValue(source);
  const { result, errorMessage } = computeResult(mode, language, deferredSource, options);

  const changeLanguage = (nextLanguage: FormatterLanguage): void => { setLanguage(nextLanguage); setSource(examples[nextLanguage]); };
  const extension = languageLabels.find((item) => item.value === language)?.extension ?? "txt";

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Beautify" title="Code Formatter" description="JSON·JavaScript·TypeScript·CSS·HTML·SQL·Markdown을 브라우저에서 정리하거나 압축합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-toolbar formatter-toolbar">
        <label>언어<select value={language} onChange={(event) => changeLanguage(event.target.value as FormatterLanguage)}>{languageLabels.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        {language === "SQL" ? null : (
          <label>들여쓰기<select value={options.tabSize} onChange={(event) => setOptions((current) => ({ ...current, tabSize: Number(event.target.value) as 2 | 4 }))}><option value={2}>2칸</option><option value={4}>4칸</option></select></label>
        )}
        {language === "JAVASCRIPT" || language === "TYPESCRIPT" ? <><label>따옴표<select value={options.quoteStyle} onChange={(event) => setOptions((current) => ({ ...current, quoteStyle: event.target.value as FormatterOptions["quoteStyle"] }))}><option value="DOUBLE">큰따옴표</option><option value="SINGLE">작은따옴표</option></select></label><label className="checkbox-label"><input type="checkbox" checked={options.semicolons} onChange={(event) => setOptions((current) => ({ ...current, semicolons: event.target.checked }))} />세미콜론</label></> : null}
        {language === "SQL" ? (
          <>
            <label className="checkbox-label"><input type="checkbox" checked={options.sqlUppercase} onChange={(event) => setOptions((current) => ({ ...current, sqlUppercase: event.target.checked }))} />키워드 대문자</label>
            {/* 정렬 방식·들여쓰기 칸 수·코멘트 주석·Java 출력은 SQL 전용 화면에서 */}
            <Link className="ghost-button formatter-sql-link" to="/utilities/sql-formatter">SQL 옵션 더 보기 →</Link>
          </>
        ) : null}
        {/* 결과 방식: 고른 버튼만 밝게. 입력하면 고른 방식으로 바로 결과가 나온다. */}
        <div className="segmented-buttons" role="group" aria-label="결과 방식">
          <button type="button" className={mode === "FORMAT" ? "active" : undefined} aria-pressed={mode === "FORMAT"} onClick={() => setMode("FORMAT")}>정리</button>
          <button type="button" className={mode === "MINIFY" ? "active" : undefined} aria-pressed={mode === "MINIFY"} onClick={() => setMode("MINIFY")}>압축(Minify)</button>
        </div>
        <button type="button" className="ghost-button" onClick={() => setSource("")}>초기화</button>
      </div>
      <div className="utility-editor-grid"><label><span>입력</span>{/* 입력·결과 글자에 언어별 문법 색을 입힌다(색은 라이트·다크 테마별 CSS 변수) */}<HighlightedTextarea language={language.toLowerCase()} aria-label="포맷할 소스 입력" value={source} onChange={(event) => setSource(event.target.value)} /></label><label><span>결과</span><HighlightedTextarea language={language.toLowerCase()} aria-label="포맷 결과" value={result} readOnly placeholder="입력하면 여기에 바로 정리 결과가 나옵니다." /></label></div>
      {/* 입력 중에는 문법이 잠깐씩 틀리므로 role="alert"(즉시 끼어들어 읽기) 대신 aria-live="polite"로 조용히 알린다 */}
      {errorMessage ? <p className="field-error" aria-live="polite">문법 오류: {errorMessage}</p> : null}
      <div className="utility-result-actions"><span>입력 {new Blob([source]).size.toLocaleString("ko-KR")} bytes → 결과 {new Blob([result]).size.toLocaleString("ko-KR")} bytes</span><button type="button" className="ghost-button" disabled={!result} onClick={() => void copyText(result).then(() => applicationNotification.success("결과를 복사했습니다."))}>복사</button><button type="button" className="ghost-button" disabled={!result} onClick={() => downloadText(`formatted.${extension}`, result)}>다운로드</button></div>
      <div className="utility-warning"><strong>Formatter 범위</strong> JSON은 실제 파서로 검증합니다. 그 외 언어는 학습용 경량 정리기이므로 복잡한 Template Literal, JSX, CSS 함수, SQL dialect의 완전한 AST 포맷팅은 지원하지 않습니다. SQL의 정렬 방식·들여쓰기·코멘트 주석·Java 출력은 SQL Formatter에서 고를 수 있습니다.</div>
      <UtilityHelpDialog isOpen={helpOpen} title="Code Formatter" description="언어별로 흩어진 Source Formatting과 Code Beautify를 한 화면으로 통합했습니다." onClose={() => setHelpOpen(false)}><article><h3>사용 방법</h3><ol><li>언어를 선택하고 소스를 입력합니다.</li><li>들여쓰기와 언어별 옵션을 정합니다. SQL의 세부 옵션은 "SQL 옵션 더 보기"(SQL Formatter)에서 고릅니다.</li><li>입력하면 결과가 바로 나옵니다. 결과 방식(정리·압축)과 옵션을 바꿔도 바로 다시 계산됩니다.</li><li>결과를 복사하거나 확장자에 맞춰 다운로드합니다.</li></ol></article><article><h3>학습 포인트</h3><p>JSON처럼 문법 파서가 있는 형식과 단순 문자열 정규화의 정확도 차이, 옵션 상태와 오류 상태 처리를 비교할 수 있습니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
