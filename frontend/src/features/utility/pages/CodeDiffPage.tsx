import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { compareCode, createUnifiedPatch, type DiffRow } from "@/features/utility/utils/codeDiff";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const beforeExample = `interface User {
  id: number;
  name: string;
}

const greeting = "hello";`;
const afterExample = `interface User {
  id: number;
  name: string;
  role: "USER" | "ADMIN";
}

const greeting = "Hello DevNote";`;

const InlineDiffText = ({ row, side }: { row: DiffRow; side: "OLD" | "NEW" }) => {
  const current = side === "OLD" ? row.oldText : row.newText;
  const other = side === "OLD" ? row.newText : row.oldText;
  if (row.type !== "CHANGED") return <>{current || " "}</>;
  let prefixLength = 0;
  while (prefixLength < current.length && prefixLength < other.length && current[prefixLength] === other[prefixLength]) prefixLength += 1;
  let suffixLength = 0;
  while (suffixLength < current.length - prefixLength && suffixLength < other.length - prefixLength
    && current[current.length - 1 - suffixLength] === other[other.length - 1 - suffixLength]) suffixLength += 1;
  const changedEnd = suffixLength === 0 ? current.length : current.length - suffixLength;
  return <>{current.slice(0, prefixLength)}<mark>{current.slice(prefixLength, changedEnd) || " "}</mark>{current.slice(changedEnd)}</>;
};

export const CodeDiffPage = () => {
  const [oldSource, setOldSource] = useState(beforeExample);
  const [newSource, setNewSource] = useState(afterExample);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [language, setLanguage] = useState("TypeScript");
  const [helpOpen, setHelpOpen] = useState(false);
  const comparison = useMemo(() => {
    try {
      return { rows: compareCode(oldSource, newSource, { ignoreWhitespace, ignoreCase }), errorMessage: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "코드를 비교하지 못했습니다.";
      return { rows: [], errorMessage: message };
    }
  }, [ignoreCase, ignoreWhitespace, newSource, oldSource]);
  const { rows, errorMessage } = comparison;
  const changedCount = rows.filter((row) => row.type !== "EQUAL").length;
  const patch = createUnifiedPatch("before", "after", rows);

  const swap = (): void => {
    setOldSource(newSource);
    setNewSource(oldSource);
  };

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Compare" title="Code Diff" description="기존 코드와 변경 코드를 줄 단위·인라인으로 비교하고 패치 파일로 내보냅니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-toolbar">
        <label>언어<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Plain Text</option><option>JavaScript</option><option>TypeScript</option><option>Java</option><option>SQL</option><option>HTML</option><option>CSS</option></select></label>
        <label className="checkbox-label"><input type="checkbox" checked={ignoreWhitespace} onChange={(event) => setIgnoreWhitespace(event.target.checked)} />공백 무시</label>
        <label className="checkbox-label"><input type="checkbox" checked={ignoreCase} onChange={(event) => setIgnoreCase(event.target.checked)} />대소문자 무시</label>
        <button type="button" className="ghost-button" onClick={swap}>⇄ 좌우 교환</button>
        <button type="button" className="ghost-button" disabled={changedCount === 0} onClick={() => void copyText(patch).then(() => applicationNotification.success("패치를 복사했습니다."))}>패치 복사</button>
        <button type="button" className="ghost-button" disabled={changedCount === 0} onClick={() => downloadText("changes.patch", patch)}>패치 다운로드</button>
      </div>
      <div className="utility-editor-grid">
        <label><span>기존 코드</span><textarea aria-label="기존 코드" value={oldSource} spellCheck={false} onChange={(event) => setOldSource(event.target.value)} /></label>
        <label><span>변경 코드</span><textarea aria-label="변경 코드" value={newSource} spellCheck={false} onChange={(event) => setNewSource(event.target.value)} /></label>
      </div>
      {errorMessage ? <p className="field-error" role="alert">{errorMessage}</p> : null}
      <section className="diff-result-panel" aria-label="코드 비교 결과">
        <header><div><h2>비교 결과</h2><p>{language} · 변경 행 {changedCount.toLocaleString("ko-KR")}개</p></div><div className="diff-legend"><span className="removed">삭제</span><span className="added">추가</span><span className="changed">변경</span></div></header>
        {rows.length === 0 ? <div className="portfolio-state-panel">비교할 코드를 입력해 주세요.</div> : <div className="diff-table">
          {rows.map((row) => <div className={`diff-row ${row.type.toLowerCase()}`} key={row.rowId}>
            <span className="diff-line-number">{row.oldLineNumber ?? ""}</span><code><InlineDiffText row={row} side="OLD" /></code>
            <span className="diff-line-number">{row.newLineNumber ?? ""}</span><code><InlineDiffText row={row} side="NEW" /></code>
          </div>)}
        </div>}
      </section>
      <UtilityHelpDialog isOpen={helpOpen} title="Code Diff" description="두 텍스트의 가장 긴 공통 부분을 기준으로 추가·삭제·변경 행을 찾습니다." onClose={() => setHelpOpen(false)}>
        <article><h3>사용 방법</h3><ol><li>왼쪽에 변경 전, 오른쪽에 변경 후 코드를 입력합니다.</li><li>필요하면 공백·대소문자 무시를 선택합니다.</li><li>행 배경과 진한 인라인 표시로 차이를 확인합니다.</li><li>리뷰용 패치를 복사하거나 다운로드합니다.</li></ol></article>
        <article><h3>학습 포인트</h3><p>이 화면은 LCS(Longest Common Subsequence) 기반 줄 비교, 계산 상태의 파생, 옵션에 따른 메모이제이션 대상 구분을 연습합니다.</p></article>
        <article><h3>주의사항</h3><p>교육용 비교기로 Git의 rename·move 감지까지 지원하지 않으며, 성능 보호를 위해 각 입력은 약 1,000줄로 제한합니다.</p></article>
      </UtilityHelpDialog>
    </section>
  );
};
