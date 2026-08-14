import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { formatStructuredData, generateJavaRecords, generateTypeScriptInterfaces, parseStructuredData, sortObjectKeys, validateJsonSchema, type StructuredFormat } from "@/features/utility/utils/dataConverter";
import { applicationNotification } from "@/shared/notification/applicationNotification";

type ConverterMode = "CONVERT" | "TYPESCRIPT" | "JAVA" | "SCHEMA";

const examples: Record<StructuredFormat, string> = {
  JSON: JSON.stringify({ developer: { name: "DevNote", active: true, skills: ["React", "Spring Boot"] } }, null, 2),
  YAML: "developer:\n  name: DevNote\n  active: true\n  skills:\n    - React\n    - Spring Boot",
  XML: '<?xml version="1.0" encoding="UTF-8"?>\n<developer>\n  <name>DevNote</name>\n  <active>true</active>\n  <skills>React</skills>\n  <skills>Spring Boot</skills>\n</developer>',
};

const extensions: Record<StructuredFormat, string> = { JSON: "json", YAML: "yaml", XML: "xml" };
const schemaExample = JSON.stringify({
  type: "object",
  required: ["developer"],
  properties: {
    developer: {
      type: "object",
      required: ["name", "active"],
      properties: {
        name: { type: "string" },
        active: { type: "boolean" },
        skills: { type: "array", items: { type: "string" } },
      },
    },
  },
}, null, 2);

export const DataConverterPage = () => {
  const [inputFormat, setInputFormat] = useState<StructuredFormat>("JSON");
  const [outputFormat, setOutputFormat] = useState<StructuredFormat>("YAML");
  const [mode, setMode] = useState<ConverterMode>("CONVERT");
  const [source, setSource] = useState(examples.JSON);
  const [schemaSource, setSchemaSource] = useState(schemaExample);
  const [result, setResult] = useState("");
  const [sortKeys, setSortKeys] = useState(false);
  const [rootName, setRootName] = useState("RootDto");
  const [errorMessage, setErrorMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const parsedPreview = useMemo(() => {
    try { return parseStructuredData(inputFormat, source); } catch { return undefined; }
  }, [inputFormat, source]);

  const run = (): void => {
    setErrorMessage("");
    try {
      let value = parseStructuredData(inputFormat, source);
      if (sortKeys) value = sortObjectKeys(value);
      const nextResult = mode === "SCHEMA"
        ? (() => {
            const validation = validateJsonSchema(value, JSON.parse(schemaSource));
            return validation.valid
              ? "✓ JSON Schema 검증을 통과했습니다."
              : [`✕ JSON Schema 검증에 실패했습니다. (${validation.errors.length}건)`, ...validation.errors.map((message) => `- ${message}`)].join("\n");
          })()
        : mode === "TYPESCRIPT"
        ? generateTypeScriptInterfaces(value, rootName || "RootDto")
        : mode === "JAVA"
          ? generateJavaRecords(value, rootName || "RootDto")
          : formatStructuredData(outputFormat, value);
      setResult(nextResult);
      applicationNotification.success(mode === "CONVERT" ? "데이터를 변환했습니다." : mode === "SCHEMA" ? "JSON Schema 검증을 마쳤습니다." : "DTO 초안을 생성했습니다.");
    } catch (error) {
      setResult("");
      setErrorMessage(error instanceof Error ? error.message : "데이터를 변환하지 못했습니다.");
    }
  };

  const changeInputFormat = (format: StructuredFormat): void => {
    setInputFormat(format); setSource(examples[format]); setResult(""); setErrorMessage("");
  };
  const swap = (): void => {
    if (mode !== "CONVERT") return;
    setInputFormat(outputFormat); setOutputFormat(inputFormat); setSource(result || examples[outputFormat]); setResult("");
  };
  const outputFileName = mode === "TYPESCRIPT" ? "generated-types.ts" : mode === "JAVA" ? `${rootName || "RootDto"}.java` : mode === "SCHEMA" ? "schema-validation.txt" : `converted.${extensions[outputFormat]}`;

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Structured Data" title="Data Converter" description="JSON·YAML·XML을 검증·정리·변환하고 DTO 초안과 JSON Schema 검증 결과를 만듭니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-mode-tabs" role="tablist" aria-label="데이터 변환 모드"><button type="button" role="tab" aria-selected={mode === "CONVERT"} className={mode === "CONVERT" ? "active" : undefined} onClick={() => setMode("CONVERT")}>포맷 변환</button><button type="button" role="tab" aria-selected={mode === "TYPESCRIPT"} className={mode === "TYPESCRIPT" ? "active" : undefined} onClick={() => setMode("TYPESCRIPT")}>TypeScript Interface</button><button type="button" role="tab" aria-selected={mode === "JAVA"} className={mode === "JAVA" ? "active" : undefined} onClick={() => setMode("JAVA")}>Java DTO</button><button type="button" role="tab" aria-selected={mode === "SCHEMA"} className={mode === "SCHEMA" ? "active" : undefined} onClick={() => setMode("SCHEMA")}>JSON Schema 검증</button></div>
      <div className="utility-toolbar">
        <label>입력<select value={inputFormat} onChange={(event) => changeInputFormat(event.target.value as StructuredFormat)}><option>JSON</option><option>YAML</option><option>XML</option></select></label>
        {mode === "CONVERT" ? <><button type="button" className="ghost-button" disabled={!result} onClick={swap}>⇄ 교환</button><label>출력<select value={outputFormat} onChange={(event) => { setOutputFormat(event.target.value as StructuredFormat); setResult(""); }}><option>JSON</option><option>YAML</option><option>XML</option></select></label></> : mode === "SCHEMA" ? null : <label>타입 이름<input value={rootName} onChange={(event) => setRootName(event.target.value.replace(/[^A-Za-z0-9_$]/g, ""))} /></label>}
        <label className="checkbox-label"><input type="checkbox" checked={sortKeys} onChange={(event) => setSortKeys(event.target.checked)} />객체 키 정렬</label>
        <button type="button" onClick={run}>{mode === "CONVERT" ? "변환하기" : mode === "SCHEMA" ? "Schema 검증" : "초안 생성"}</button>
        <button type="button" className="ghost-button" onClick={() => { setSource(""); setResult(""); setErrorMessage(""); }}>초기화</button>
      </div>
      <div className="utility-editor-grid">
        <label><span>{inputFormat} 입력 · {new Blob([source]).size.toLocaleString("ko-KR")} bytes</span><textarea aria-label={`${inputFormat} 입력`} value={source} spellCheck={false} onChange={(event) => { setSource(event.target.value); setResult(""); }} /></label>
        {mode === "SCHEMA"
          ? <label><span>JSON Schema 입력</span><textarea aria-label="JSON Schema 입력" value={schemaSource} spellCheck={false} onChange={(event) => { setSchemaSource(event.target.value); setResult(""); }} /></label>
          : <label><span>{mode === "CONVERT" ? `${outputFormat} 결과` : mode === "JAVA" ? "Java record 초안" : "TypeScript Interface 초안"}</span><textarea aria-label="변환 결과" value={result} readOnly spellCheck={false} placeholder="변환 결과가 여기에 표시됩니다." /></label>}
      </div>
      {errorMessage ? <p className="field-error" role="alert">{errorMessage}</p> : null}
      {mode === "SCHEMA" && result ? <pre className={`tool-result-card${result.startsWith("✓") ? "" : " error-state"}`} aria-live="polite">{result}</pre> : null}
      <div className="utility-result-actions"><span>{parsedPreview !== undefined ? "✓ 입력 문법을 해석할 수 있습니다." : "입력 문법을 확인하는 중입니다."}</span><button type="button" className="ghost-button" disabled={!result} onClick={() => void copyText(result).then(() => applicationNotification.success("결과를 복사했습니다."))}>복사</button><button type="button" className="ghost-button" disabled={!result} onClick={() => downloadText(outputFileName, result)}>다운로드</button></div>
      {parsedPreview !== undefined ? <details className="json-tree-preview"><summary>JSON Tree 형태로 구조 확인</summary><pre>{JSON.stringify(parsedPreview, null, 2)}</pre></details> : null}
      <div className="utility-warning"><strong>{mode === "SCHEMA" ? "Schema 지원 범위" : "DTO 생성 안내"}</strong> {mode === "SCHEMA" ? "학습용 검증기는 type, required, properties, items, enum을 지원합니다. oneOf, anyOf, $ref 같은 고급 키워드는 별도 Schema 라이브러리가 필요한 확장 과제입니다." : "생성 코드는 데이터 한 건을 보고 추론한 초안입니다. nullable, 배열의 여러 타입, 날짜·금액 타입과 Validation은 프로젝트 규칙에 맞게 검토해 주세요."}</div>
      <UtilityHelpDialog isOpen={helpOpen} title="Data Converter" description="서로 다른 구조화 데이터 형식을 하나의 JavaScript 값으로 바꾼 뒤 원하는 형식으로 출력합니다." onClose={() => setHelpOpen(false)}>
        <article><h3>처리 흐름</h3><ol><li>입력 포맷의 파서로 문법을 검증합니다.</li><li>공통 객체·배열 구조로 변환합니다.</li><li>키 정렬 옵션을 적용합니다.</li><li>선택한 포맷 또는 DTO 코드로 직렬화합니다.</li></ol></article>
        <article><h3>XML 보안</h3><p>DOCTYPE과 외부 Entity가 포함된 XML은 XXE 위험 때문에 거부하며 네트워크에 접근하지 않습니다.</p></article>
        <article><h3>YAML 범위</h3><p>학습용 경량 파서는 일반적인 객체·배열·문자열·숫자·boolean·null을 지원합니다. Anchor, Alias, 다중 문서 같은 고급 YAML 문법은 지원하지 않습니다.</p></article>
      </UtilityHelpDialog>
    </section>
  );
};
