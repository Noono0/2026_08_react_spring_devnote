/**
 * codeDiff.ts — 두 코드(글)를 줄 단위로 비교하는 도구(코드 비교 화면용)
 *
 * [방법: 최장 공통 부분 수열(LCS)]
 *   두 글에서 "순서를 지키며 똑같이 남아 있는 줄"이 가장 많아지는 짝을 찾는다.
 *   그 짝에 들지 못한 줄은 삭제(REMOVED) 또는 추가(ADDED)이고, 삭제와 추가가 붙어 있으면 "바뀜(CHANGED)"으로 묶는다.
 *   표 크기가 (옛 줄 수 × 새 줄 수)라서 너무 크면(100만 칸 초과) 브라우저가 멈추지 않게 거부한다.
 */

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

/** 화면의 비교 표 한 줄(왼쪽 옛 줄 · 오른쪽 새 줄). 줄 번호가 없으면 그쪽에는 해당 줄이 없다는 뜻. */
export interface DiffRow {
  rowId: string;
  type: "EQUAL" | "ADDED" | "REMOVED" | "CHANGED";
  oldLineNumber?: number;
  newLineNumber?: number;
  oldText: string;
  newText: string;
}

interface DiffOperation {
  type: "EQUAL" | "ADDED" | "REMOVED";
  text: string;
  lineNumber: number;
  matchingLineNumber?: number;
}

/** 비교용으로 줄을 정리한다: 공백 무시면 모든 공백 제거, 대소문자 무시면 소문자로. 화면에는 원래 글을 보여 준다. */
const normalizeLine = (line: string, options: DiffOptions): string => {
  let normalized = options.ignoreWhitespace ? line.replace(/\s+/g, "") : line;
  if (options.ignoreCase) normalized = normalized.toLocaleLowerCase();
  return normalized;
};

/**
 * 1단계: lengths[i][j] = "옛 i번째 줄부터, 새 j번째 줄부터"의 최장 공통 줄 수를 뒤에서부터 채운다(동적 계획법).
 * 2단계: 앞에서부터 표를 따라가며 같으면 EQUAL, 아니면 공통 줄을 더 많이 남기는 쪽으로 ADDED/REMOVED를 고른다.
 * Uint32Array: 숫자 전용 배열이라 일반 배열보다 메모리를 적게 쓴다.
 */
const createOperations = (oldLines: string[], newLines: string[], options: DiffOptions): DiffOperation[] => {
  if (oldLines.length * newLines.length > 1_000_000) {
    throw new Error("비교 가능한 크기를 초과했습니다. 각 입력을 1,000줄 이하로 줄여 주세요.");
  }
  const lengths = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(newLines.length + 1));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex]![newIndex] = normalizeLine(oldLines[oldIndex] ?? "", options) === normalizeLine(newLines[newIndex] ?? "", options)
        ? (lengths[oldIndex + 1]?.[newIndex + 1] ?? 0) + 1
        : Math.max(lengths[oldIndex + 1]?.[newIndex] ?? 0, lengths[oldIndex]?.[newIndex + 1] ?? 0);
    }
  }

  const operations: DiffOperation[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];
    if (oldLine !== undefined && newLine !== undefined && normalizeLine(oldLine, options) === normalizeLine(newLine, options)) {
      operations.push({ type: "EQUAL", text: oldLine, lineNumber: oldIndex + 1, matchingLineNumber: newIndex + 1 });
      oldIndex += 1;
      newIndex += 1;
    } else if (newLine !== undefined && (oldLine === undefined || (lengths[oldIndex]?.[newIndex + 1] ?? 0) >= (lengths[oldIndex + 1]?.[newIndex] ?? 0))) {
      operations.push({ type: "ADDED", text: newLine, lineNumber: newIndex + 1 });
      newIndex += 1;
    } else if (oldLine !== undefined) {
      operations.push({ type: "REMOVED", text: oldLine, lineNumber: oldIndex + 1 });
      oldIndex += 1;
    }
  }
  return operations;
};

/** 화면용 비교 결과. 줄바꿈(\r\n)을 \n으로 맞춘 뒤 비교하고, 연속된 삭제·추가 묶음을 한 줄씩 짝지어 CHANGED로 만든다. */
export const compareCode = (oldSource: string, newSource: string, options: DiffOptions): DiffRow[] => {
  const oldLines = oldSource.replace(/\r\n/g, "\n").split("\n");
  const newLines = newSource.replace(/\r\n/g, "\n").split("\n");
  const operations = createOperations(oldLines, newLines, options);
  const rows: DiffRow[] = [];
  let operationIndex = 0;

  while (operationIndex < operations.length) {
    const operation = operations[operationIndex];
    if (operation?.type === "EQUAL") {
      rows.push({ rowId: `equal-${operationIndex}`, type: "EQUAL", oldLineNumber: operation.lineNumber, newLineNumber: operation.matchingLineNumber, oldText: operation.text, newText: operation.text });
      operationIndex += 1;
      continue;
    }
    const removed: DiffOperation[] = [];
    const added: DiffOperation[] = [];
    while (operations[operationIndex] && operations[operationIndex]?.type !== "EQUAL") {
      const blockOperation = operations[operationIndex];
      if (blockOperation?.type === "REMOVED") removed.push(blockOperation);
      if (blockOperation?.type === "ADDED") added.push(blockOperation);
      operationIndex += 1;
    }
    const blockLength = Math.max(removed.length, added.length);
    for (let blockIndex = 0; blockIndex < blockLength; blockIndex += 1) {
      const removedLine = removed[blockIndex];
      const addedLine = added[blockIndex];
      rows.push({
        rowId: `change-${operationIndex}-${blockIndex}`,
        type: removedLine && addedLine ? "CHANGED" : removedLine ? "REMOVED" : "ADDED",
        oldLineNumber: removedLine?.lineNumber,
        newLineNumber: addedLine?.lineNumber,
        oldText: removedLine?.text ?? "",
        newText: addedLine?.text ?? "",
      });
    }
  }
  return rows;
};

/** git diff와 비슷한 통합 패치 글(--- 옛 파일 / +++ 새 파일, 줄 앞 - 삭제 · + 추가 · 공백 같음)을 만든다. */
export const createUnifiedPatch = (oldName: string, newName: string, rows: DiffRow[]): string => {
  const changedRows = rows.filter((row) => row.type !== "EQUAL");
  if (changedRows.length === 0) return "변경 사항이 없습니다.\n";
  return [
    `--- ${oldName}`,
    `+++ ${newName}`,
    "@@ line diff @@",
    ...rows.flatMap((row) => row.type === "EQUAL" ? [` ${row.oldText}`] : [
      ...(row.oldLineNumber ? [`-${row.oldText}`] : []),
      ...(row.newLineNumber ? [`+${row.newText}`] : []),
    ]),
  ].join("\n");
};
