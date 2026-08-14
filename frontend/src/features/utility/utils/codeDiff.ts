export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

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

const normalizeLine = (line: string, options: DiffOptions): string => {
  let normalized = options.ignoreWhitespace ? line.replace(/\s+/g, "") : line;
  if (options.ignoreCase) normalized = normalized.toLocaleLowerCase();
  return normalized;
};

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
