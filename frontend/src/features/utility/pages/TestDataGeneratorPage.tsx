import { useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { generateTestData, testDataToCsv, testDataToSql, type SqlDialect, type TestDataRow, type TestDataRule, type TestDataType } from "@/features/utility/utils/testDataGenerator";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const typeOptions: Array<{ value: TestDataType; label: string }> = [
  { value: "SEQUENCE", label: "순번" }, { value: "STRING", label: "문자열" }, { value: "NAME", label: "이름" },
  { value: "EMAIL", label: "이메일" }, { value: "PHONE", label: "전화번호" }, { value: "INTEGER", label: "정수" },
  { value: "DECIMAL", label: "소수·금액" }, { value: "DATE", label: "날짜" }, { value: "UUID", label: "UUID" },
  { value: "BOOLEAN", label: "Boolean" }, { value: "ENUM", label: "Enum" },
];

const initialRules: TestDataRule[] = [
  { ruleId: crypto.randomUUID(), columnName: "id", type: "SEQUENCE", option: "", nullPercentage: 0, allowDuplicate: false },
  { ruleId: crypto.randomUUID(), columnName: "name", type: "NAME", option: "", nullPercentage: 0, allowDuplicate: true },
  { ruleId: crypto.randomUUID(), columnName: "email", type: "EMAIL", option: "", nullPercentage: 0, allowDuplicate: false },
  { ruleId: crypto.randomUUID(), columnName: "role", type: "ENUM", option: "USER,ADMIN,SUPER_ADMIN", nullPercentage: 0, allowDuplicate: true },
];

const optionPlaceholder = (type: TestDataType): string => type === "ENUM" ? "USER,ADMIN" : type === "INTEGER" || type === "DECIMAL" ? "최소,최대 예: 1,100" : type === "STRING" ? "접두사 예: sample" : "추가 옵션 없음";

export const TestDataGeneratorPage = () => {
  const [rules, setRules] = useState(initialRules);
  const [count, setCount] = useState(20);
  const [tableName, setTableName] = useState("sample_data");
  const [sqlDialect, setSqlDialect] = useState<SqlDialect>("MYSQL");
  const [rows, setRows] = useState<TestDataRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const updateRule = (ruleId: string, patch: Partial<TestDataRule>): void => setRules((current) => current.map((rule) => rule.ruleId === ruleId ? { ...rule, ...patch } : rule));
  const moveRule = (index: number, direction: -1 | 1): void => setRules((current) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.length) return current;
    const nextRules = [...current];
    const currentRule = nextRules[index];
    const targetRule = nextRules[targetIndex];
    if (!currentRule || !targetRule) return current;
    nextRules[index] = targetRule;
    nextRules[targetIndex] = currentRule;
    return nextRules;
  });
  const generate = (): void => {
    try {
      setRows(generateTestData(rules, count)); setErrorMessage(""); applicationNotification.success(`${count}개의 테스트 데이터를 만들었습니다.`);
    } catch (error) { setRows([]); setErrorMessage(error instanceof Error ? error.message : "테스트 데이터를 만들지 못했습니다."); }
  };
  const json = JSON.stringify(rows, null, 2);
  const csv = testDataToCsv(rows);
  let sql = "";
  try { sql = testDataToSql(rows, tableName, sqlDialect); } catch { sql = ""; }

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Mock Data" title="Test Data Generator" description="컬럼 규칙을 조합해 JSON·CSV·SQL INSERT 테스트 데이터를 브라우저에서 생성합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-toolbar"><label>생성 개수<input type="number" min={1} max={1000} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label><label>SQL 종류<select value={sqlDialect} onChange={(event) => setSqlDialect(event.target.value as SqlDialect)}><option value="MYSQL">MySQL</option><option value="POSTGRESQL">PostgreSQL</option><option value="SQL_SERVER">SQL Server</option><option value="GENERIC">표준·따옴표 없음</option></select></label><label>SQL 테이블명<input value={tableName} onChange={(event) => setTableName(event.target.value)} /></label><button type="button" onClick={generate}>데이터 생성</button><button type="button" className="ghost-button" onClick={() => setRows([])}>결과 초기화</button></div>
      <section className="test-rule-panel"><header><div><h2>생성 규칙</h2><p>컬럼별 타입·옵션·Null·중복 여부를 설정합니다.</p></div><button type="button" className="ghost-button" onClick={() => setRules((current) => [...current, { ruleId: crypto.randomUUID(), columnName: `field${current.length + 1}`, type: "STRING", option: "", nullPercentage: 0, allowDuplicate: true }])}>+ 규칙 추가</button></header>
        <div className="test-rule-grid-heading" aria-hidden="true"><span>컬럼명</span><span>타입</span><span>생성 옵션</span><span>Null %</span><span>중복</span><span>관리</span></div>
        {rules.map((rule, index) => <div className="test-rule-row" key={rule.ruleId}><label><span>컬럼명</span><input aria-label={`${index + 1}번 컬럼명`} value={rule.columnName} onChange={(event) => updateRule(rule.ruleId, { columnName: event.target.value })} /></label><label><span>타입</span><select aria-label={`${rule.columnName} 타입`} value={rule.type} onChange={(event) => updateRule(rule.ruleId, { type: event.target.value as TestDataType, option: "" })}>{typeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><label><span>생성 옵션</span><input value={rule.option} disabled={!(["ENUM", "INTEGER", "DECIMAL", "STRING"] as TestDataType[]).includes(rule.type)} placeholder={optionPlaceholder(rule.type)} onChange={(event) => updateRule(rule.ruleId, { option: event.target.value })} /></label><label><span>Null %</span><input type="number" min={0} max={100} value={rule.nullPercentage} onChange={(event) => updateRule(rule.ruleId, { nullPercentage: Math.min(100, Math.max(0, Number(event.target.value))) })} /></label><label className="checkbox-label"><input type="checkbox" checked={rule.allowDuplicate} onChange={(event) => updateRule(rule.ruleId, { allowDuplicate: event.target.checked })} />허용</label><div className="test-rule-actions"><button type="button" className="ghost-button" aria-label={`${rule.columnName} 규칙 위로 이동`} disabled={index === 0} onClick={() => moveRule(index, -1)}>↑</button><button type="button" className="ghost-button" aria-label={`${rule.columnName} 규칙 아래로 이동`} disabled={index === rules.length - 1} onClick={() => moveRule(index, 1)}>↓</button><button type="button" className="ghost-button danger-button" aria-label={`${rule.columnName} 규칙 삭제`} disabled={rules.length === 1} onClick={() => setRules((current) => current.filter((item) => item.ruleId !== rule.ruleId))}>×</button></div></div>)}
      </section>
      {errorMessage ? <p className="field-error" role="alert">{errorMessage}</p> : null}
      <section className="test-data-result"><header><div><h2>미리보기</h2><p>화면에는 처음 50행만 표시하고 다운로드에는 전체 생성 결과를 사용합니다.</p></div><div><button type="button" className="ghost-button" disabled={!rows.length} onClick={() => void copyText(json).then(() => applicationNotification.success("JSON을 복사했습니다."))}>JSON 복사</button><button type="button" className="ghost-button" disabled={!rows.length} onClick={() => downloadText("test-data.json", json, "application/json;charset=utf-8")}>JSON</button><button type="button" className="ghost-button" disabled={!rows.length} onClick={() => downloadText("test-data.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8")}>CSV</button><button type="button" className="ghost-button" disabled={!rows.length || !sql} onClick={() => downloadText("test-data.sql", sql, "application/sql;charset=utf-8")}>SQL</button></div></header>
        {rows.length === 0 ? <div className="portfolio-state-panel">규칙을 설정하고 데이터를 생성해 주세요.</div> : <div className="test-data-table-wrap"><table><thead><tr>{Object.keys(rows[0] ?? {}).map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0, 50).map((row, rowIndex) => <tr key={rowIndex}>{Object.keys(rows[0] ?? {}).map((key) => <td key={key}>{row[key] === null ? <em>NULL</em> : String(row[key])}</td>)}</tr>)}</tbody></table></div>}
      </section>
      <UtilityHelpDialog isOpen={helpOpen} title="Test Data Generator" description="폼으로 생성 규칙 배열을 편집하고 형식별 직렬화를 연습합니다." onClose={() => setHelpOpen(false)}>
        <article><h3>사용 방법</h3><ol><li>컬럼 규칙을 추가하고 이름과 타입을 정합니다.</li><li>Enum이나 숫자 범위 같은 옵션을 입력합니다.</li><li>1~1,000개 데이터를 생성합니다.</li><li>미리보기 후 JSON·CSV·SQL로 다운로드합니다.</li></ol></article>
        <article><h3>SQL 안전</h3><p>DB 종류별 식별자 따옴표와 Boolean 표현을 구분합니다. 테이블·컬럼명은 영문자·숫자·밑줄만 허용하며 문자열의 작은따옴표를 두 번 써서 escaping합니다. 생성 SQL은 개발용 DB에서 검토 후 사용하세요.</p></article>
      </UtilityHelpDialog>
    </section>
  );
};
