import { useMemo, useState, type ChangeEvent } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import {
  convertJsonCsv,
  type CsvDelimiter,
  type JsonCsvConversionResult,
  type JsonCsvDirection,
} from "@/features/utility/utils/jsonCsvConverter";

const MAXIMUM_INPUT_SIZE_BYTES = 2 * 1024 * 1024;
const MAXIMUM_PREVIEW_ROW_COUNT = 50;

const exampleSources: Record<JsonCsvDirection, string> = {
  JSON_TO_CSV: JSON.stringify([
    { id: 1, name: "홍길동", role: "Frontend Developer", active: true },
    { id: 2, name: "김개발", role: "Backend, API", active: false },
    { id: 3, name: "이리액트", role: "Full Stack", active: true },
  ], null, 2),
  CSV_TO_JSON: "id,name,role,active\r\n1,홍길동,Frontend Developer,true\r\n2,김개발,\"Backend, API\",false\r\n3,이리액트,Full Stack,true",
};

const directionLabels: Record<JsonCsvDirection, { input: string; output: string; action: string }> = {
  JSON_TO_CSV: { input: "JSON 입력", output: "CSV 결과", action: "CSV로 변환" },
  CSV_TO_JSON: { input: "CSV 입력", output: "JSON 결과", action: "JSON으로 변환" },
};

export const JsonCsvConverterPage = () => {
  const [direction, setDirection] = useState<JsonCsvDirection>("JSON_TO_CSV");
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [inferValueTypes, setInferValueTypes] = useState(false);
  const [source, setSource] = useState(exampleSources.JSON_TO_CSV);
  const [conversionResult, setConversionResult] = useState<JsonCsvConversionResult>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [helpOpen, setHelpOpen] = useState(false);

  const labels = directionLabels[direction];
  const previewRows = useMemo(
    () => conversionResult?.previewRows.slice(0, MAXIMUM_PREVIEW_ROW_COUNT) ?? [],
    [conversionResult],
  );

  const resetResult = (): void => {
    setConversionResult(undefined);
    setErrorMessage(undefined);
  };

  const changeDirection = (nextDirection: JsonCsvDirection): void => {
    setDirection(nextDirection);
    setSource(exampleSources[nextDirection]);
    resetResult();
  };

  const convert = (): void => {
    if (new Blob([source]).size > MAXIMUM_INPUT_SIZE_BYTES) {
      setConversionResult(undefined);
      setErrorMessage("입력 크기는 최대 2MB까지 지원합니다.");
      return;
    }
    try {
      setConversionResult(convertJsonCsv(source, { direction, delimiter, firstRowIsHeader, inferValueTypes }));
      setErrorMessage(undefined);
    } catch (conversionError) {
      setConversionResult(undefined);
      setErrorMessage(conversionError instanceof Error ? conversionError.message : "변환 중 오류가 발생했습니다.");
    }
  };

  const swapInputAndOutput = (): void => {
    if (!conversionResult) {
      applicationNotification.warning("먼저 변환을 실행해 주세요.");
      return;
    }
    setDirection((currentDirection) => currentDirection === "JSON_TO_CSV" ? "CSV_TO_JSON" : "JSON_TO_CSV");
    setSource(conversionResult.output);
    resetResult();
  };

  const copyResult = async (): Promise<void> => {
    if (!conversionResult) return;
    try {
      await navigator.clipboard.writeText(conversionResult.output);
      applicationNotification.success("변환 결과를 복사했습니다.");
    } catch {
      applicationNotification.error("클립보드에 복사하지 못했습니다.");
    }
  };

  const downloadResult = (): void => {
    if (!conversionResult) return;
    const outputIsCsv = direction === "JSON_TO_CSV";
    // CSV 앞에 UTF-8 BOM을 붙이면 Windows Excel에서도 한글이 깨질 가능성이 줄어듭니다.
    const downloadContent = outputIsCsv ? `\uFEFF${conversionResult.output}` : conversionResult.output;
    const downloadBlob = new Blob([downloadContent], {
      type: outputIsCsv ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(downloadBlob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = downloadUrl;
    downloadAnchor.download = outputIsCsv ? "converted-data.csv" : "converted-data.json";
    downloadAnchor.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const importFile = async (fileChangeEvent: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = fileChangeEvent.target.files?.[0];
    fileChangeEvent.target.value = "";
    if (!selectedFile) return;
    if (selectedFile.size > MAXIMUM_INPUT_SIZE_BYTES) {
      applicationNotification.warning("2MB 이하의 JSON 또는 CSV 파일을 선택해 주세요.");
      return;
    }
    try {
      setSource(await selectedFile.text());
      resetResult();
      applicationNotification.success(`${selectedFile.name} 파일을 불러왔습니다.`);
    } catch {
      applicationNotification.error("파일 내용을 읽지 못했습니다.");
    }
  };

  return (
    <section className="site-page json-csv-converter-page">
      <div className="page-heading-row utility-tool-heading">
        <div>
          <span className="page-kicker">Data · Browser Only</span>
          <h1>JSON ↔ CSV Converter</h1>
          <p>JSON 객체 배열과 CSV 표 데이터를 브라우저 안에서 안전하게 양방향 변환합니다.</p>
        </div>
        <button type="button" className="learning-guide-icon-button" aria-label="JSON CSV Converter 도움말" onClick={() => setHelpOpen(true)}>?</button>
      </div>

      <div className="data-converter-direction" role="tablist" aria-label="변환 방향">
        <button type="button" role="tab" aria-selected={direction === "JSON_TO_CSV"} className={direction === "JSON_TO_CSV" ? "active" : undefined} onClick={() => changeDirection("JSON_TO_CSV")}>JSON → CSV</button>
        <button type="button" role="tab" aria-selected={direction === "CSV_TO_JSON"} className={direction === "CSV_TO_JSON" ? "active" : undefined} onClick={() => changeDirection("CSV_TO_JSON")}>CSV → JSON</button>
      </div>

      <div className="data-converter-toolbar">
        <label>구분자
          <select value={delimiter} onChange={(event) => { setDelimiter(event.target.value as CsvDelimiter); resetResult(); }}>
            <option value=",">쉼표 (,)</option>
            <option value=";">세미콜론 (;)</option>
            <option value="\t">탭 (Tab)</option>
          </select>
        </label>
        {direction === "CSV_TO_JSON" ? <label className="checkbox-label"><input type="checkbox" checked={firstRowIsHeader} onChange={(event) => { setFirstRowIsHeader(event.target.checked); resetResult(); }} />첫 행을 Header로 사용</label> : null}
        {direction === "CSV_TO_JSON" ? <label className="checkbox-label" title="00123처럼 앞에 0이 붙은 값은 문자열로 유지합니다."><input type="checkbox" checked={inferValueTypes} onChange={(event) => { setInferValueTypes(event.target.checked); resetResult(); }} />숫자·boolean·null 타입 추론</label> : null}
        <label className="file-button secondary-button">파일 불러오기<input type="file" accept={direction === "JSON_TO_CSV" ? ".json,application/json" : ".csv,text/csv,text/plain"} onChange={(event) => void importFile(event)} /></label>
        <button type="button" className="ghost-button" onClick={() => { setSource(exampleSources[direction]); resetResult(); }}>예제</button>
        <button type="button" className="ghost-button" onClick={() => { setSource(""); resetResult(); }}>초기화</button>
      </div>

      <div className="data-converter-grid">
        <article className="data-converter-editor">
          <header><div><h2>{labels.input}</h2><span>{new Blob([source]).size.toLocaleString("ko-KR")} / {MAXIMUM_INPUT_SIZE_BYTES.toLocaleString("ko-KR")} bytes</span></div></header>
          <textarea value={source} aria-label={labels.input} spellCheck={false} placeholder={`${labels.input} 내용을 붙여넣으세요.`} onChange={(event) => { setSource(event.target.value); resetResult(); }} />
        </article>

        <div className="data-converter-actions">
          <button type="button" onClick={convert}>{labels.action}<span>→</span></button>
          <button type="button" className="ghost-button" aria-label="입력과 결과 교환" onClick={swapInputAndOutput}>⇄</button>
        </div>

        <article className="data-converter-editor">
          <header><div><h2>{labels.output}</h2>{conversionResult ? <span>{conversionResult.rowCount.toLocaleString("ko-KR")}행</span> : null}</div><div><button type="button" className="ghost-button" disabled={!conversionResult} onClick={() => void copyResult()}>복사</button><button type="button" className="ghost-button" disabled={!conversionResult} onClick={downloadResult}>다운로드</button></div></header>
          {errorMessage ? <div className="data-converter-error" role="alert"><strong>변환할 수 없습니다.</strong><p>{errorMessage}</p></div> : <textarea value={conversionResult?.output ?? ""} aria-label={labels.output} readOnly spellCheck={false} placeholder="변환 결과가 여기에 표시됩니다." />}
        </article>
      </div>

      <article className="data-preview-panel">
        <header><div><span className="page-kicker">Preview</span><h2>표 미리보기</h2></div>{conversionResult ? <span>{conversionResult.headers.length}열 · {conversionResult.rowCount}행</span> : null}</header>
        {!conversionResult ? <div className="data-preview-empty">변환을 실행하면 결과의 앞 50행을 표로 확인할 수 있습니다.</div> : (
          <div className="data-preview-table-wrap">
            <table><thead><tr>{conversionResult.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{previewRows.map((row, rowIndex) => <tr key={`preview-row-${rowIndex}`}>{conversionResult.headers.map((header, columnIndex) => <td key={`${header}-${columnIndex}`}>{row[columnIndex] ?? ""}</td>)}</tr>)}</tbody></table>
            {conversionResult.rowCount > MAXIMUM_PREVIEW_ROW_COUNT ? <p>화면 성능을 위해 앞 {MAXIMUM_PREVIEW_ROW_COUNT}행만 표시합니다. 다운로드 결과에는 전체 데이터가 포함됩니다.</p> : null}
          </div>
        )}
      </article>

      <ModalDialog isOpen={helpOpen} title="JSON ↔ CSV Converter 도움말" description="JSON과 CSV의 구조 차이와 안전한 변환 규칙을 확인합니다." size="large" onRequestClose={() => setHelpOpen(false)}>
        <div className="converter-help-grid">
          <article><h3>JSON → CSV</h3><ol><li>최상위 값이 객체 배열인 JSON을 입력합니다.</li><li>구분자를 선택하고 변환합니다.</li><li>CSV 결과와 표 미리보기를 확인합니다.</li></ol></article>
          <article><h3>CSV → JSON</h3><ol><li>CSV를 붙여넣거나 파일을 불러옵니다.</li><li>Header·타입 추론 옵션을 선택합니다.</li><li>JSON 결과를 복사하거나 다운로드합니다.</li></ol></article>
          <article><h3>CSV 처리 규칙</h3><p>쉼표, 큰따옴표, 줄바꿈이 포함된 셀은 큰따옴표로 감싸며, 셀 안 큰따옴표는 <code>""</code>처럼 두 번 작성합니다.</p></article>
          <article><h3>학습 포인트</h3><p>문자 단위 상태 머신, escaping, 타입 가드, 예외 상태, Blob 다운로드와 큰 데이터 미리보기를 확인할 수 있습니다.</p></article>
        </div>
        <div className="api-help-warning"><strong>주의사항</strong><ul><li>입력은 서버로 전송하거나 저장하지 않습니다.</li><li>JSON의 중첩 객체와 배열은 CSV 한 셀 안에 JSON 문자열로 들어갑니다.</li><li>타입 추론은 기본 OFF이며, 00123 같은 값은 추론을 켜도 문자열로 유지합니다.</li><li>한 번에 최대 2MB·10,000행을 지원합니다.</li></ul></div>
      </ModalDialog>
    </section>
  );
};
