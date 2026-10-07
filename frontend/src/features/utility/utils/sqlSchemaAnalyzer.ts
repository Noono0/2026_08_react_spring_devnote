// sqlSchemaAnalyzer.ts — CREATE TABLE 문(DDL)을 읽어 테이블·컬럼·키 구조를 뽑고, ERD(Mermaid) 생성과 두 스키마 비교를 하는 도구
// SQL 파서를 쓰지 않고 괄호 짝 찾기·쉼표 나누기·정규식으로 MySQL/PostgreSQL/SQL Server에서 흔한 문법을 읽는다.

export interface SqlSchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  defaultValue?: string;
}

export interface SqlSchemaForeignKey {
  name?: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface SqlSchemaTable {
  name: string;
  columns: SqlSchemaColumn[];
  foreignKeys: SqlSchemaForeignKey[];
}

export interface SqlSchemaModel {
  tables: SqlSchemaTable[];
  warnings: string[];
}

export interface SqlSchemaDiff {
  addedTables: string[];
  removedTables: string[];
  changedTables: Array<{ table: string; addedColumns: string[]; removedColumns: string[]; changedColumns: string[] }>;
}

// 이름을 감싼 `백틱`·"따옴표"·[대괄호]를 벗기고 schema.table 형태는 점으로 나눠 각각 정리한다.
const normalizeIdentifier = (value: string): string => value.trim().split(".").map((part) => part.trim().replace(/^`|`$/g, "").replace(/^"|"$/g, "").replace(/^\[|\]$/g, "")).filter(Boolean).join(".");
const parseIdentifierList = (value: string): string[] => value.split(",").map((item) => normalizeIdentifier(item)).filter(Boolean);

// 블록 주석과 -- 줄 주석을 먼저 지워, 주석 안의 괄호·쉼표가 구조 해석을 망치지 않게 한다.
const removeSqlComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\r\n]*/g, "");

const findClosingParenthesis = (source: string, openingIndex: number): number => {
  let depth = 0;
  let quote = "";
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (quote) {
      if (character === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = "";
      } else if (character === "\\") index += 1;
      continue;
    }
    if (["'", '"', "`"].includes(character)) { quote = character; continue; }
    if (character === "(") depth += 1;
    if (character === ")") { depth -= 1; if (depth === 0) return index; }
  }
  return -1;
};

// 괄호 안쪽의 쉼표(DECIMAL(10,2) 등)는 무시하고, 바깥쪽 쉼표로만 컬럼·제약 정의를 나눈다.
const splitTopLevel = (source: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (quote) {
      if (character === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = "";
      } else if (character === "\\") index += 1;
      continue;
    }
    if (["'", '"', "`"].includes(character)) { quote = character; continue; }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) { parts.push(source.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
};

const readLeadingIdentifier = (definition: string): { name: string; rest: string } | undefined => {
  const match = definition.match(/^\s*(`[^`]+`|"[^"]+"|\[[^\]]+\]|[A-Za-z_][\w$]*)\s+([\s\S]+)$/);
  return match?.[1] && match[2] ? { name: normalizeIdentifier(match[1]), rest: match[2].trim() } : undefined;
};

const readColumnType = (rest: string): string => {
  let depth = 0;
  let end = rest.length;
  for (let index = 0; index < rest.length; index += 1) {
    const character = rest[index] ?? "";
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (/\s/.test(character) && depth === 0) {
      const remaining = rest.slice(index).trimStart();
      if (/^(?:NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|DEFAULT|AUTO_INCREMENT|AUTOINCREMENT|GENERATED|REFERENCES|CHECK|COLLATE|COMMENT)\b/i.test(remaining)) { end = index; break; }
    }
  }
  return rest.slice(0, end).trim().replace(/\s+/g, " ");
};

// FOREIGN KEY (컬럼들) REFERENCES 테이블(컬럼들) 모양을 읽는다.
const parseForeignKey = (definition: string): SqlSchemaForeignKey | undefined => {
  const match = definition.match(/^(?:CONSTRAINT\s+(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.]+)\s*\(([^)]+)\)/i);
  if (!match?.[2] || !match[3] || !match[4]) return undefined;
  return { name: match[1] ? normalizeIdentifier(match[1]) : undefined, columns: parseIdentifierList(match[2]), referencedTable: normalizeIdentifier(match[3]), referencedColumns: parseIdentifierList(match[4]) };
};

// 괄호 안 정의 하나하나를 컬럼(이름 + 타입 + NOT NULL·PRIMARY KEY·UNIQUE 등) 또는 표 단위 제약(PRIMARY KEY(...), FOREIGN KEY ...)으로 분류한다.
const parseTableBody = (tableName: string, body: string): SqlSchemaTable => {
  const columns: SqlSchemaColumn[] = [];
  const foreignKeys: SqlSchemaForeignKey[] = [];
  const primaryKeys = new Set<string>();
  const uniqueColumns = new Set<string>();
  splitTopLevel(body).forEach((definition) => {
    const foreignKey = parseForeignKey(definition);
    if (foreignKey) { foreignKeys.push(foreignKey); return; }
    const primaryMatch = definition.match(/^(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (primaryMatch?.[1]) { parseIdentifierList(primaryMatch[1]).forEach((column) => primaryKeys.add(column)); return; }
    const uniqueMatch = definition.match(/^(?:CONSTRAINT\s+\S+\s+)?UNIQUE(?:\s+(?:KEY|INDEX)\s+\S+)?\s*\(([^)]+)\)/i);
    if (uniqueMatch?.[1]) { parseIdentifierList(uniqueMatch[1]).forEach((column) => uniqueColumns.add(column)); return; }
    if (/^(?:KEY|INDEX|CHECK|CONSTRAINT)\b/i.test(definition)) return;
    const leading = readLeadingIdentifier(definition);
    if (!leading) return;
    const defaultMatch = leading.rest.match(/\bDEFAULT\s+((?:'[^']*(?:''[^']*)*')|(?:"[^"]*")|[^\s,]+)/i);
    const column: SqlSchemaColumn = {
      name: leading.name,
      type: readColumnType(leading.rest),
      nullable: !/\bNOT\s+NULL\b/i.test(leading.rest),
      primaryKey: /\bPRIMARY\s+KEY\b/i.test(leading.rest),
      unique: /\bUNIQUE\b/i.test(leading.rest),
      autoIncrement: /\b(?:AUTO_INCREMENT|AUTOINCREMENT|IDENTITY)\b/i.test(leading.rest),
      defaultValue: defaultMatch?.[1],
    };
    const inlineReference = leading.rest.match(/\bREFERENCES\s+(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.]+)\s*\(([^)]+)\)/i);
    if (inlineReference?.[1] && inlineReference[2]) foreignKeys.push({ columns: [column.name], referencedTable: normalizeIdentifier(inlineReference[1]), referencedColumns: parseIdentifierList(inlineReference[2]) });
    columns.push(column);
  });
  return { name: tableName, columns: columns.map((column) => ({ ...column, primaryKey: column.primaryKey || primaryKeys.has(column.name), unique: column.unique || uniqueColumns.has(column.name) })), foreignKeys };
};

// CREATE TABLE을 하나씩 찾아 해석한 뒤 점검한다: 같은 이름 테이블 중복, 기본 키 없음, 참조 테이블·컬럼이 입력에 없음.
export const analyzeSqlSchema = (source: string): SqlSchemaModel => {
  if (!source.trim()) throw new Error("CREATE TABLE DDL을 입력해 주세요.");
  if (new Blob([source]).size > 2 * 1024 * 1024) throw new Error("DDL 입력은 2MB 이하만 처리할 수 있습니다.");
  const normalized = removeSqlComments(source);
  const tables: SqlSchemaTable[] = [];
  const createPattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi;
  while (createPattern.exec(normalized) !== null) {
    const openingIndex = normalized.indexOf("(", createPattern.lastIndex);
    if (openingIndex < 0) break;
    const rawTableName = normalized.slice(createPattern.lastIndex, openingIndex).trim();
    const tableNameMatch = rawTableName.match(/^(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$.]+)/);
    if (!tableNameMatch?.[1]) { createPattern.lastIndex = openingIndex + 1; continue; }
    const closingIndex = findClosingParenthesis(normalized, openingIndex);
    if (closingIndex < 0) throw new Error(`${normalizeIdentifier(tableNameMatch[1])} 테이블의 닫는 괄호를 찾지 못했습니다.`);
    tables.push(parseTableBody(normalizeIdentifier(tableNameMatch[1]), normalized.slice(openingIndex + 1, closingIndex)));
    createPattern.lastIndex = closingIndex + 1;
  }
  if (tables.length === 0) throw new Error("CREATE TABLE 문을 찾지 못했습니다.");
  const warnings: string[] = [];
  const tableMap = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  const duplicateNames = tables.map((table) => table.name.toLowerCase()).filter((name, index, names) => names.indexOf(name) !== index);
  [...new Set(duplicateNames)].forEach((name) => warnings.push(`${name}: 같은 이름의 테이블이 두 번 정의되어 있습니다.`));
  tables.forEach((table) => {
    if (table.columns.length === 0) warnings.push(`${table.name}: 해석된 컬럼이 없습니다.`);
    if (!table.columns.some((column) => column.primaryKey)) warnings.push(`${table.name}: Primary Key가 없습니다.`);
    table.foreignKeys.forEach((foreignKey) => {
      const referenced = tableMap.get(foreignKey.referencedTable.toLowerCase());
      if (!referenced) warnings.push(`${table.name}: 참조 테이블 ${foreignKey.referencedTable}이 입력에 없습니다.`);
      foreignKey.columns.forEach((column) => { if (!table.columns.some((item) => item.name === column)) warnings.push(`${table.name}: FK 컬럼 ${column}이 테이블에 없습니다.`); });
      foreignKey.referencedColumns.forEach((column) => { if (referenced && !referenced.columns.some((item) => item.name === column)) warnings.push(`${table.name}: 참조 컬럼 ${foreignKey.referencedTable}.${column}이 없습니다.`); });
    });
  });
  return { tables, warnings };
};

const mermaidIdentifier = (value: string): string => value.replace(/[^A-Za-z0-9_]/g, "_");
// Mermaid erDiagram 글을 만든다. ||--o{ 는 "참조되는 쪽 1 : 참조하는 쪽 여러 개" 관계 표시다.
export const generateMermaidErDiagram = (model: SqlSchemaModel): string => {
  const tableBlocks = model.tables.map((table) => {
    const columns = table.columns.map((column) => `    ${column.type.replace(/[^A-Za-z0-9_]/g, "_") || "UNKNOWN"} ${mermaidIdentifier(column.name)}${column.primaryKey ? " PK" : ""}${column.unique ? " UK" : ""}`);
    return `  ${mermaidIdentifier(table.name)} {\n${columns.join("\n")}\n  }`;
  });
  const relationships = model.tables.flatMap((table) => table.foreignKeys.map((foreignKey) => `  ${mermaidIdentifier(foreignKey.referencedTable)} ||--o{ ${mermaidIdentifier(table.name)} : "${foreignKey.columns.join(", ")}"`));
  return ["erDiagram", ...tableBlocks, ...relationships].join("\n");
};

// 이전·이후 스키마 비교: 추가·삭제된 테이블, 그리고 같은 테이블 안의 추가·삭제·변경(타입·NULL·PK·UNIQUE)된 컬럼.
export const compareSqlSchemas = (before: SqlSchemaModel, after: SqlSchemaModel): SqlSchemaDiff => {
  const beforeMap = new Map(before.tables.map((table) => [table.name.toLowerCase(), table]));
  const afterMap = new Map(after.tables.map((table) => [table.name.toLowerCase(), table]));
  const addedTables = after.tables.filter((table) => !beforeMap.has(table.name.toLowerCase())).map((table) => table.name);
  const removedTables = before.tables.filter((table) => !afterMap.has(table.name.toLowerCase())).map((table) => table.name);
  const changedTables = before.tables.flatMap((beforeTable) => {
    const afterTable = afterMap.get(beforeTable.name.toLowerCase());
    if (!afterTable) return [];
    const beforeColumns = new Map(beforeTable.columns.map((column) => [column.name.toLowerCase(), column]));
    const afterColumns = new Map(afterTable.columns.map((column) => [column.name.toLowerCase(), column]));
    const addedColumns = afterTable.columns.filter((column) => !beforeColumns.has(column.name.toLowerCase())).map((column) => column.name);
    const removedColumns = beforeTable.columns.filter((column) => !afterColumns.has(column.name.toLowerCase())).map((column) => column.name);
    const changedColumns = beforeTable.columns.filter((column) => {
      const next = afterColumns.get(column.name.toLowerCase());
      return next && (next.type !== column.type || next.nullable !== column.nullable || next.primaryKey !== column.primaryKey || next.unique !== column.unique);
    }).map((column) => column.name);
    return addedColumns.length || removedColumns.length || changedColumns.length ? [{ table: beforeTable.name, addedColumns, removedColumns, changedColumns }] : [];
  });
  return { addedTables, removedTables, changedTables };
};
