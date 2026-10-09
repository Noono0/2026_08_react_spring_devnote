/**
 * ============================================================================
 * sqlFormatter.ts — SQL 정리(Beautify) + 테이블·칼럼 코멘트를 주석으로 붙이기
 * ============================================================================
 *
 * dpriver Instant SQL Formatter의 기본 출력 모양을 따른다.
 *
 * [정렬 방식 RIVER — 키워드 정렬(기본)]          [정렬 방식 INDENT — 들여쓰기 N칸]
 *   SELECT u.id,                                   SELECT
 *          Count(o.id)  AS orders_count,               u.id,
 *          Sum(o.total) AS revenue                     Count(o.id) AS orders_count
 *   FROM   users u                                 FROM users u
 *          LEFT JOIN orders o                          LEFT JOIN orders o
 *                 ON o.user_id = u.id                      ON o.user_id = u.id
 *   WHERE  u.status = 'A'                          WHERE u.status = 'A'
 *           OR EXISTS (SELECT 1                        OR EXISTS (SELECT 1 ...
 *                      FROM   bans b ...)
 *   키워드를 7칸에 맞춰 내용 시작 열을 세운다.     키워드 아래로 정한 칸 수만큼 들인다.
 *
 * [처리 순서]
 *   1) sqlTokenizer로 토큰을 만들고, 토큰마다 대소문자(키워드·함수·이름)를 정한다.
 *   2) 괄호 밖(깊이 0)의 큰 키워드(SELECT, FROM, JOIN, WHERE ...)로 "절(clause)"을 나눈다.
 *   3) 절마다 줄을 만든다. 목록은 쉼표마다, 조건은 AND/OR마다 줄을 바꾸고, CASE는 WHEN/ELSE마다 펼친다.
 *      괄호 안이 SELECT로 시작하면(서브쿼리) 같은 규칙으로 다시 정리해 "(" 다음 열에 맞춘다(재귀).
 *   4) FROM·JOIN의 별칭(u → users)으로 칼럼(u.id)이 어느 테이블 것인지 찾아 코멘트를 붙인다.
 *   5) 주석 위치를 한 열로 맞춰 출력한다. SQL은 "-- 코멘트", MyBatis는 "/* 코멘트 *\/".
 *
 * [출력 줄의 열(column)]
 *   모든 줄은 "문장 맨 앞에서 몇 칸째인지"를 절대 열로 다룬다. 단, 표현식 조각(Fragment)의 첫 줄만은
 *   부르는 쪽이 앞에 글자(키워드 등)를 붙이므로 들여쓰기 없이 돌려준다.
 *
 * ★ 원래 쿼리에 있던 주석은 그 항목 줄 끝으로 옮겨 그대로 두고, 그 항목에는 코멘트를 새로 붙이지 않는다.
 * ★ 학습용 경량 정리기다. MyBatis 동적 태그(<if> 등), DB별 특수 문법(프로시저 등)은 지원하지 않는다.
 */
import { normalizeSqlName, type SqlCommentDictionary } from "@/features/utility/utils/sqlCommentDictionary";
import { tokenizeSql, type SqlToken } from "@/features/utility/utils/sqlTokenizer";

export type SqlLayout = "RIVER" | "INDENT";
export type SqlCase = "UPPER" | "LOWER" | "CAPITAL" | "UNCHANGED";
export type SqlCommaPosition = "AFTER" | "BEFORE" | "BEFORE_SPACE";
export type SqlCommentStyle = "SQL" | "MYBATIS";

export interface SqlFormatOptions {
  layout: SqlLayout; // RIVER: 키워드 정렬, INDENT: 들여쓰기 N칸
  indentSize: number; // INDENT에서 쓰는 칸 수(1~10)
  keywordCase: SqlCase; // SELECT, FROM ...
  functionCase: SqlCase; // COUNT(...), SUM(...)
  identifierCase: SqlCase; // 테이블·칼럼·별칭 이름
  commaPosition: SqlCommaPosition; // 목록 쉼표를 항목 뒤/앞에
  stackLists: boolean; // 목록 항목을 한 줄에 하나씩
  alignAliases: boolean; // SELECT 목록의 AS 별칭을 한 열로 맞춤
  logicalUnderKeyword: boolean; // AND/OR를 WHERE 키워드 아래 열에서 시작
  commentStyle: SqlCommentStyle;
  dictionary?: SqlCommentDictionary; // 없으면 코멘트를 붙이지 않는다
}

export interface SqlFormatResult {
  text: string;
  addedCommentCount: number; // 코멘트 사전에서 찾아 새로 붙인 주석 수
}

export const SQL_INDENT_RANGE = { min: 1, max: 10, initial: 4 } as const;

/**
 * 기본값: 키워드·함수·테이블/칼럼 이름 모두 대문자, 쉼표 뒤, 한 줄에 하나.
 * (dpriver 기본은 함수 첫 글자 대문자(Count)·이름 그대로 — DPRIVER_CASE_OPTIONS로 같은 모양을 만들 수 있다)
 */
/** dpriver Instant SQL Formatter 기본 대소문자(함수 Count, 이름은 쓴 그대로). Code Formatter의 SQL이 이 모양을 쓴다. */
export const DPRIVER_CASE_OPTIONS = { functionCase: "CAPITAL", identifierCase: "UNCHANGED" } as const satisfies Partial<SqlFormatOptions>;

export const defaultSqlFormatOptions: SqlFormatOptions = {
  layout: "RIVER",
  indentSize: SQL_INDENT_RANGE.initial,
  keywordCase: "UPPER",
  functionCase: "UPPER",
  identifierCase: "UPPER",
  commaPosition: "AFTER",
  stackLists: true,
  alignAliases: true,
  logicalUnderKeyword: false,
  commentStyle: "SQL",
};

/** 대소문자를 맞출 키워드 */
const sqlKeywords = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "GROUP", "ORDER", "BY", "HAVING",
  "LIMIT", "OFFSET", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "UNION", "ALL", "AND", "OR", "AS", "ON", "IN",
  "IS", "NOT", "NULL", "CASE", "WHEN", "THEN", "ELSE", "END", "DISTINCT", "ASC", "DESC", "LIKE", "BETWEEN", "EXISTS", "WITH", "USING",
]);

/**
 * 절을 시작하는 키워드(구). 긴 것부터 맞춰 본다.
 * "LEFT JOIN"을 "JOIN"보다, "DELETE FROM"을 "FROM"보다 먼저 봐야 앞 낱말이 따로 떨어지지 않는다.
 */
const clausePhrases: string[][] = [
  ["LEFT", "OUTER", "JOIN"], ["RIGHT", "OUTER", "JOIN"], ["FULL", "OUTER", "JOIN"],
  ["LEFT", "JOIN"], ["RIGHT", "JOIN"], ["FULL", "JOIN"], ["INNER", "JOIN"], ["CROSS", "JOIN"],
  ["GROUP", "BY"], ["ORDER", "BY"], ["INSERT", "INTO"], ["DELETE", "FROM"], ["UNION", "ALL"],
  ["JOIN"], ["UNION"], ["SELECT"], ["FROM"], ["WHERE"], ["HAVING"], ["LIMIT"], ["OFFSET"], ["VALUES"], ["UPDATE"], ["SET"],
];

/** 쉼표마다 한 줄씩 펴는 절 */
const listClauses = new Set(["SELECT", "FROM", "GROUP BY", "ORDER BY", "SET"]);
/** AND/OR마다 줄을 바꾸는 절 */
const conditionClauses = new Set(["WHERE", "HAVING"]);
/** 테이블 이름이 오는 절(별칭 모으기·테이블 코멘트) */
const tableClauses = new Set(["UPDATE", "INSERT INTO", "DELETE FROM"]);

/** RIVER에서 키워드 칸 너비. "SELECT "(7칸)에 맞춰 FROM·WHERE 뒤를 띄운다. */
const RIVER_KEYWORD_WIDTH = 7;
/** RIVER에서 INSERT 칼럼 목록·VALUES 행이 시작하는 열("INSERT INTO " 다음) */
const RIVER_INSERT_LIST_WIDTH = "INSERT INTO ".length;
/** 이 열보다 긴 줄이 있으면 그 줄만 한 칸 띄우고 주석을 붙인다(주석 열이 너무 멀리 밀려나지 않게). */
const MAX_COMMENT_COLUMN = 80;

/** 토큰 + 화면에 쓸 글자(대소문자 적용)와 함수 이름 여부 */
interface FormatToken extends SqlToken {
  display: string;
  isFunction: boolean;
}

interface SqlClause {
  keyword: string; // "LEFT JOIN"처럼 대문자로 이은 구. 키워드 없이 시작한 앞부분은 "", 문장 끝(;) 다음은 ";"
  keywordTokens: FormatToken[];
  body: FormatToken[];
}

/** 출력 한 줄. text는 문장 맨 앞부터의 들여쓰기를 포함한다(조각 첫 줄 제외). */
interface OutputLine {
  text: string;
  comments: string[];
  blank?: boolean; // 문장(;) 사이 빈 줄
}
/** 표현식 조각. 첫 줄은 들여쓰기 없이, 둘째 줄부터는 절대 열 들여쓰기를 포함한다. */
type Fragment = OutputLine[];

/** 코멘트를 어떤 기준으로 찾을지: 테이블 줄, SELECT 칼럼 줄, SET(칼럼 = 값) 줄 */
type CommentRole = "table" | "column" | "set";

interface FormatContext {
  options: SqlFormatOptions;
  aliases: Map<string, string>; // 별칭 → 테이블(바깥 쿼리 것까지)
  stats: { addedCommentCount: number };
}

const isWord = (token: SqlToken | undefined, word: string): boolean => token?.type === "word" && token.text.toUpperCase() === word;
const isKeyword = (token: SqlToken | undefined): boolean => token?.type === "word" && sqlKeywords.has(token.text.toUpperCase());
const spaces = (count: number): string => " ".repeat(Math.max(0, count));
const withoutComments = <T extends SqlToken>(tokens: T[]): T[] => tokens.filter((token) => token.type !== "comment");
const commentsOf = (tokens: SqlToken[]): string[] => tokens.filter((token) => token.type === "comment").map((token) => token.text).filter(Boolean);
const lastLine = (fragment: Fragment): OutputLine => fragment[fragment.length - 1] ?? { text: "", comments: [] };

export const applySqlCase = (text: string, mode: SqlCase): string => {
  if (mode === "UPPER") return text.toUpperCase();
  if (mode === "LOWER") return text.toLowerCase();
  if (mode === "CAPITAL") return `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
  return text;
};

/** 토큰마다 화면에 쓸 글자를 정한다. 키워드·함수·이름(테이블·칼럼)에 각각 다른 대소문자 옵션을 쓴다. */
const annotateTokens = (tokens: SqlToken[], options: SqlFormatOptions): FormatToken[] => {
  const meaningful = withoutComments(tokens);
  const positions = new Map(meaningful.map((token, index) => [token, index]));
  return tokens.map((token) => {
    if (token.type !== "word") return { ...token, display: token.text, isFunction: false };
    const index = positions.get(token) ?? -1;
    const previous = meaningful[index - 1];
    const next = meaningful[index + 1];
    const afterDot = previous?.type === "dot"; // u.order처럼 점 뒤는 키워드라도 이름이다
    const isLiteralOrParameter = /^["`#$@:?\d]/.test(token.text); // "따옴표 이름", #{param}, 숫자는 그대로
    if (!afterDot && isKeyword(token)) return { ...token, display: applySqlCase(token.text, options.keywordCase), isFunction: false };
    if (isLiteralOrParameter) return { ...token, display: token.text, isFunction: false };
    // 뒤에 "("가 오면 함수 이름. 단 INSERT INTO members (a, b)의 members는 테이블이다.
    const isFunction = !afterDot && next?.type === "open" && !isWord(previous, "INTO");
    return { ...token, display: applySqlCase(token.text, isFunction ? options.functionCase : options.identifierCase), isFunction };
  });
};

/** 두 토큰 사이에 띄어쓰기가 필요한지. 쉼표·닫는 괄호·점 앞, 여는 괄호·점 뒤, 함수 이름과 "(" 사이는 붙인다. */
const spaceBetween = (previous: FormatToken | undefined, token: FormatToken): boolean => {
  if (!previous) return false;
  if (["comma", "close", "semicolon", "dot"].includes(token.type)) return false;
  if (previous.type === "open" || previous.type === "dot") return false;
  if (token.type === "open" && previous.isFunction) return false;
  if (token.text === "::" || previous.text === "::") return false;
  return true;
};

/**
 * 토큰을 한 줄 글자로 잇는다.
 *   - -1처럼 부호로 쓰인 -, +는 뒤 숫자와 붙인다.
 *   - IN 목록 괄호 안쪽은 dpriver처럼 한 칸씩 띄운다: IN ( 'a', 'b' )
 */
const joinTokens = (tokens: FormatToken[]): string => {
  let text = "";
  let previous: FormatToken | undefined;
  let previousIsUnarySign = false;
  const spacedParentheses: boolean[] = []; // 열린 괄호마다 "안쪽을 띄우는 IN 목록인지"
  for (const token of withoutComments(tokens)) {
    const closesSpacedList = token.type === "close" && spacedParentheses.pop() === true;
    const opensAfterSpacedList = previous?.type === "open" && spacedParentheses.at(-1) === true;
    const needsSpace = (spaceBetween(previous, token) && !previousIsUnarySign) || closesSpacedList || opensAfterSpacedList;
    text += `${needsSpace ? " " : ""}${token.display}`;
    if (token.type === "open") spacedParentheses.push(isWord(previous, "IN"));
    previousIsUnarySign = (token.text === "-" || token.text === "+")
      && (!previous || ["open", "comma", "symbol"].includes(previous.type) || isKeyword(previous));
    previous = token;
  }
  return text;
};

/** 괄호 깊이와 CASE ... END 깊이를 함께 센다. 둘 다 0일 때만 "맨 바깥"이다. */
const createDepthTracker = () => {
  let parenthesisDepth = 0;
  let caseDepth = 0;
  return {
    /** 토큰을 보기 전에 호출한다. 이 토큰이 맨 바깥에 있는지 돌려준다. */
    visit(token: SqlToken): boolean {
      const isTopLevel = parenthesisDepth === 0 && caseDepth === 0;
      if (token.type === "open") parenthesisDepth += 1;
      if (token.type === "close") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      if (parenthesisDepth === 0 && isWord(token, "CASE")) caseDepth += 1;
      if (parenthesisDepth === 0 && isWord(token, "END")) caseDepth = Math.max(0, caseDepth - 1);
      return isTopLevel;
    },
  };
};

/** tokens[openIndex]의 "("와 짝인 ")" 위치. 짝이 없으면 -1 */
const findMatchingClose = (tokens: SqlToken[], openIndex: number): number => {
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index]?.type === "open") depth += 1;
    if (tokens[index]?.type === "close") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
};

/** tokens[index]에서 시작하는 절 키워드 구를 찾는다(괄호 밖에서만 호출). */
const matchClausePhrase = (tokens: SqlToken[], index: number): string[] | undefined =>
  clausePhrases.find((phrase) => phrase.every((word, offset) => isWord(tokens[index + offset], word)));

/**
 * 맨 바깥의 절 키워드로 토큰을 절 단위로 나눈다.
 * 자기 줄에 따로 있던 주석(newlineBefore)은 다음 토큰이 무엇인지 보고 어디에 붙일지 정한다.
 */
const splitClauses = (tokens: FormatToken[]): SqlClause[] => {
  const clauses: SqlClause[] = [];
  let current: SqlClause = { keyword: "", keywordTokens: [], body: [] };
  let pendingLeadingComments: FormatToken[] = [];
  const tracker = createDepthTracker();
  const startClause = (clause: SqlClause): void => {
    if (current.keyword || current.body.length > 0) clauses.push(current);
    current = clause;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token.type === "comment" && token.newlineBefore) {
      pendingLeadingComments.push(token);
      continue;
    }
    // "LIMIT 50; -- 끝"처럼 ; 바로 뒤 같은 줄 주석은 앞 문장의 마지막 줄에 붙인다.
    const previousClause = clauses.at(-1);
    if (token.type === "comment" && current.keyword === ";" && current.body.length === 0 && previousClause) {
      previousClause.body.push(token);
      continue;
    }
    const isTopLevel = tracker.visit(token);
    const phrase = token.type === "word" && isTopLevel ? matchClausePhrase(tokens, index) : undefined;
    if (phrase) {
      startClause({ keyword: phrase.join(" "), keywordTokens: tokens.slice(index, index + phrase.length), body: pendingLeadingComments });
      pendingLeadingComments = [];
      index += phrase.length - 1;
      continue;
    }
    current.body.push(...pendingLeadingComments, token);
    pendingLeadingComments = [];
    if (token.type === "semicolon") startClause({ keyword: ";", keywordTokens: [], body: [] }); // 문장 끝: 다음 문장과 빈 줄로 나눈다
  }
  current.body.push(...pendingLeadingComments);
  startClause({ keyword: "", keywordTokens: [], body: [] });
  return clauses;
};

/** 맨 바깥 쉼표로 목록 항목을 나눈다(쉼표는 뺀다). 쉼표 바로 뒤 같은 줄 주석은 앞 항목에 붙인다. */
const splitByCommas = (tokens: FormatToken[]): FormatToken[][] => {
  const items: FormatToken[][] = [];
  let current: FormatToken[] = [];
  const tracker = createDepthTracker();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const isTopLevel = tracker.visit(token);
    if (!isTopLevel || token.type !== "comma") {
      current.push(token);
      continue;
    }
    while (tokens[index + 1]?.type === "comment" && !tokens[index + 1]?.newlineBefore) {
      const trailingComment = tokens[index + 1];
      if (trailingComment) current.push(trailingComment);
      index += 1;
    }
    items.push(current);
    current = [];
  }
  if (current.length > 0) items.push(current);
  return items;
};

/** 맨 바깥 AND/OR 앞에서 조건을 나눈다. BETWEEN a AND b의 AND는 나누지 않는다. */
const splitByLogical = (tokens: FormatToken[]): FormatToken[][] => {
  const conditions: FormatToken[][] = [];
  let current: FormatToken[] = [];
  let waitingBetweenAnd = false;
  const tracker = createDepthTracker();
  for (const token of tokens) {
    const isTopLevel = tracker.visit(token);
    if (isTopLevel && isWord(token, "BETWEEN")) waitingBetweenAnd = true;
    const isLogical = isTopLevel && (isWord(token, "AND") || isWord(token, "OR"));
    if (isLogical && isWord(token, "AND") && waitingBetweenAnd) {
      waitingBetweenAnd = false;
    } else if (isLogical && current.some((item) => item.type !== "comment")) {
      conditions.push(current);
      current = [];
    }
    current.push(token);
  }
  if (current.length > 0) conditions.push(current);
  return conditions;
};

// ── 코멘트 찾기 ─────────────────────────────────────────────

/** "users u", "users AS u", "db.users u" → { table: "users", alias: "u" }. 서브쿼리 "(...) t"는 테이블이 아니므로 undefined */
const parseTableReference = (tokens: SqlToken[]): { table: string; alias?: string } | undefined => {
  const meaningful = withoutComments(tokens);
  if (meaningful[0]?.type !== "word" || isKeyword(meaningful[0])) return undefined;
  let index = 0;
  let table = meaningful[0].text;
  while (meaningful[index + 1]?.type === "dot" && meaningful[index + 2]?.type === "word") {
    table = meaningful[index + 2]?.text ?? table;
    index += 2;
  }
  const next = isWord(meaningful[index + 1], "AS") ? meaningful[index + 2] : meaningful[index + 1];
  const alias = next?.type === "word" && !isKeyword(next) ? next.text : undefined;
  return { table: normalizeSqlName(table), alias: alias ? normalizeSqlName(alias) : undefined };
};

/** 이 쿼리의 "별칭 → 테이블" 지도. 테이블 이름 자체로 쓴 경우(users.id)도 찾을 수 있게 테이블 → 테이블도 넣는다. */
const collectTableAliases = (clauses: SqlClause[]): Map<string, string> => {
  const aliases = new Map<string, string>();
  const remember = (tokens: SqlToken[]): void => {
    const reference = parseTableReference(tokens);
    if (!reference) return;
    aliases.set(reference.table, reference.table);
    if (reference.alias) aliases.set(reference.alias, reference.table);
  };
  for (const clause of clauses) {
    if (clause.keyword === "FROM") splitByCommas(clause.body).forEach(remember);
    else if (clause.keyword.endsWith("JOIN") || tableClauses.has(clause.keyword)) remember(clause.body);
  }
  return aliases;
};

interface ColumnReference {
  qualifier?: string; // u.id의 u
  column: string;
}

/** 표현식 안의 칼럼 참조를 찾는다. 함수 이름·키워드·숫자·파라미터·별칭(AS 뒤)은 칼럼이 아니다. */
const findColumnReferences = (tokens: SqlToken[]): ColumnReference[] => {
  const references: ColumnReference[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.type !== "word" || isKeyword(token) || /^[\d#$@:?]/.test(token.text)) continue;
    if (tokens[index + 1]?.type === "open" || tokens[index - 1]?.type === "dot" || isWord(tokens[index - 1], "AS")) continue;
    if (tokens[index + 1]?.type === "dot") {
      const columnToken = tokens[index + 2];
      if (columnToken?.type === "word") references.push({ qualifier: normalizeSqlName(token.text), column: normalizeSqlName(columnToken.text) });
      index += 2;
      continue;
    }
    references.push({ column: normalizeSqlName(token.text) });
  }
  return references;
};

/**
 * SELECT 항목에서 별칭과 표현식을 나눈다.
 *   "COUNT(o.id) AS cnt" → 표현식 COUNT(o.id), 별칭 [AS, cnt]
 *   "COUNT(o.id) cnt", "CASE ... END grade"처럼 AS 없는 별칭도 찾는다.
 */
const splitSelectAlias = <T extends SqlToken>(tokens: T[]): { expression: T[]; aliasTokens: T[] } => {
  const meaningful = tokens.filter((token) => token.type !== "comment" && token.type !== "semicolon");
  const tracker = createDepthTracker();
  const asIndex = meaningful.findIndex((token) => tracker.visit(token) && isWord(token, "AS"));
  if (asIndex > 0) return { expression: meaningful.slice(0, asIndex), aliasTokens: meaningful.slice(asIndex) };
  const last = meaningful.at(-1);
  const beforeLast = meaningful.at(-2);
  const hasImplicitAlias = last?.type === "word" && !isKeyword(last) && !/^[#$@:?\d]/.test(last.text)
    && ((beforeLast?.type === "word" && !isKeyword(beforeLast)) || beforeLast?.type === "close" || isWord(beforeLast, "END") || beforeLast?.type === "string");
  return hasImplicitAlias ? { expression: meaningful.slice(0, -1), aliasTokens: meaningful.slice(-1) } : { expression: meaningful, aliasTokens: [] };
};

/** 항목(칼럼·테이블·SET) 하나의 코멘트를 사전에서 찾는다. */
const findDictionaryComment = (role: CommentRole, itemTokens: SqlToken[], dictionary: SqlCommentDictionary, aliases: Map<string, string>): string | undefined => {
  const tablesInQuery = [...new Set(aliases.values())];
  /** u.id → users.id 코멘트. 별칭 없는 id는 이 쿼리의 테이블 중 id 칼럼이 딱 하나일 때만 정한다. */
  const findColumnComment = ({ qualifier, column }: ColumnReference): string | undefined => {
    if (qualifier) return dictionary.columns.get(aliases.get(qualifier) ?? qualifier)?.get(column) ?? dictionary.names.get(column);
    const matches = tablesInQuery.map((table) => dictionary.columns.get(table)?.get(column)).filter((comment): comment is string => comment !== undefined);
    return matches.length === 1 ? matches[0] : dictionary.names.get(column);
  };

  if (role === "table") {
    const reference = parseTableReference(itemTokens);
    return reference ? dictionary.names.get(reference.table) : undefined;
  }
  if (role === "column") {
    // 1순위: 별칭 이름(orders_count) 코멘트, 2순위: 표현식 안 칼럼이 하나뿐이면 그 칼럼 코멘트(COUNT(o.id) → o.id)
    const { expression, aliasTokens } = splitSelectAlias(itemTokens);
    const aliasName = aliasTokens.at(-1)?.text;
    const aliasComment = aliasName ? dictionary.names.get(normalizeSqlName(aliasName)) : undefined;
    if (aliasComment) return aliasComment;
    const references = findColumnReferences(expression);
    const [onlyReference] = references;
    return references.length === 1 && onlyReference ? findColumnComment(onlyReference) : undefined;
  }
  // SET name = ... 의 왼쪽 칼럼
  const equalsIndex = itemTokens.findIndex((token) => token.text === "=");
  const [target] = findColumnReferences(equalsIndex >= 0 ? itemTokens.slice(0, equalsIndex) : itemTokens);
  return target ? findColumnComment(target) : undefined;
};

/** 항목 줄에 붙일 주석: 원래 쿼리의 주석이 있으면 그것, 없으면 사전에서 찾은 코멘트 */
const itemComments = (role: CommentRole | undefined, itemTokens: FormatToken[], context: FormatContext): string[] => {
  const original = commentsOf(itemTokens);
  if (original.length > 0 || !role || !context.options.dictionary) return original;
  const found = findDictionaryComment(role, itemTokens, context.options.dictionary, context.aliases);
  if (!found) return [];
  context.stats.addedCommentCount += 1;
  return [found];
};

// ── 줄 만들기 ─────────────────────────────────────────────

/** 조각 첫 줄 앞에 글자를 붙여 절대 열 줄로 만든다. */
const placeFragment = (prefix: string, fragment: Fragment, comments: string[] = []): OutputLine[] => {
  const [first, ...rest] = fragment;
  return [{ text: `${prefix}${first?.text ?? ""}`, comments: [...comments, ...(first?.comments ?? [])] }, ...rest];
};

/** "WHEN"·"AND"처럼 조건 앞에 키워드가 붙는 줄. 조건 뒤 THEN 등은 호출한 쪽이 이어 붙인다. */
const renderLogicalLine = (condition: FormatToken[], conditionColumn: number, keywordColumn: number, context: FormatContext): OutputLine[] => {
  const [operator, ...rest] = withoutComments(condition);
  const { layout, logicalUnderKeyword } = context.options;
  const operatorText = operator?.display ?? "";
  let prefix: string;
  let expressionColumn: number;
  if (layout === "INDENT") {
    prefix = `${spaces(keywordColumn)}${operatorText} `;
    expressionColumn = prefix.length;
  } else if (logicalUnderKeyword) {
    // AND/OR를 WHERE 아래 열에서 시작하고, 조건은 첫 조건과 같은 열에 맞춘다.
    prefix = `${spaces(keywordColumn)}${operatorText.padEnd(Math.max(conditionColumn - keywordColumn, operatorText.length + 1))}`;
    expressionColumn = prefix.length;
  } else {
    // dpriver 기본: AND/OR를 오른쪽 맞춤(AND, " OR")해 뒤 조건이 같은 열에서 시작하게 한다.
    prefix = `${spaces(conditionColumn + Math.max(0, 3 - operatorText.length))}${operatorText} `;
    expressionColumn = prefix.length;
  }
  return placeFragment(prefix, renderExpression(rest, expressionColumn, context), commentsOf(condition));
};

/** CASE ... END를 WHEN·ELSE마다 펼친다. CASE와 END는 같은 열, WHEN·ELSE는 한 단계 안쪽. */
const renderCase = (tokens: FormatToken[], column: number, context: FormatContext): Fragment => {
  const segments: FormatToken[][] = [];
  let caseDepth = 0;
  let parenthesisDepth = 0;
  let current: FormatToken[] = [];
  let rest: FormatToken[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token.type === "open") parenthesisDepth += 1;
    if (token.type === "close") parenthesisDepth -= 1;
    const atCaseLevel = parenthesisDepth === 0 && caseDepth === 1;
    if (parenthesisDepth === 0 && isWord(token, "CASE")) caseDepth += 1;
    if (atCaseLevel && (isWord(token, "WHEN") || isWord(token, "ELSE"))) {
      segments.push(current);
      current = [];
    }
    if (parenthesisDepth === 0 && isWord(token, "END")) {
      caseDepth -= 1;
      if (caseDepth === 0) {
        segments.push(current);
        rest = tokens.slice(index); // END + 뒤에 오는 글자(= 1 등)
        break;
      }
    }
    current.push(token);
  }

  const innerIndent = context.options.layout === "INDENT" ? context.options.indentSize : 2;
  const branchColumn = column + innerIndent;
  const [caseHead = [], ...branches] = segments;
  const fragment: Fragment = [{ text: joinTokens(caseHead), comments: [] }];
  for (const branch of branches) {
    if (!isWord(branch[0], "WHEN")) {
      fragment.push({ text: `${spaces(branchColumn)}${joinTokens(branch)}`, comments: [] }); // ELSE ...
      continue;
    }
    // WHEN 조건(AND/OR마다 줄바꿈) THEN 결과
    const tracker = createDepthTracker();
    const thenIndex = branch.findIndex((token) => tracker.visit(token) && isWord(token, "THEN"));
    const conditionTokens = branch.slice(1, thenIndex >= 0 ? thenIndex : branch.length);
    const resultTokens = thenIndex >= 0 ? branch.slice(thenIndex) : [];
    const whenPrefix = `${spaces(branchColumn)}${branch[0]?.display ?? "WHEN"} `;
    const [firstCondition = [], ...otherConditions] = splitByLogical(conditionTokens);
    const branchLines = placeFragment(whenPrefix, renderExpression(firstCondition, whenPrefix.length, context));
    otherConditions.forEach((condition) => branchLines.push(...renderLogicalLine(condition, whenPrefix.length, branchColumn, context)));
    if (resultTokens.length > 0) lastLine(branchLines).text += ` ${joinTokens(resultTokens)}`;
    fragment.push(...branchLines);
  }
  if (rest.length > 0) fragment.push({ text: `${spaces(column)}${joinTokens(rest)}`, comments: [] });
  return fragment;
};

/**
 * 표현식 하나를 조각으로 만든다. column은 첫 글자가 놓일 절대 열이다.
 *   - CASE로 시작하면 WHEN·ELSE마다 펼친다.
 *   - 괄호 안이 SELECT/WITH로 시작하면 서브쿼리로 보고 "(" 다음 열에서 다시 정리한다.
 *   - 그 밖에는 한 줄로 잇는다.
 */
const renderExpression = (tokens: FormatToken[], column: number, context: FormatContext): Fragment => {
  const meaningful = withoutComments(tokens);
  if (isWord(meaningful[0], "CASE")) return renderCase(meaningful, column, context);

  const fragment: Fragment = [{ text: "", comments: [] }];
  let previous: FormatToken | undefined;
  let run: FormatToken[] = [];
  /** 지금 줄 끝의 절대 열 */
  const currentColumn = (): number => (fragment.length === 1 ? column : 0) + lastLine(fragment).text.length;
  const appendRun = (): void => {
    const [first] = run;
    if (!first) return;
    const line = lastLine(fragment);
    line.text += `${line.text.trim() && spaceBetween(previous, first) ? " " : ""}${joinTokens(run)}`;
    previous = run[run.length - 1];
    run = [];
  };

  for (let index = 0; index < meaningful.length; index += 1) {
    const token = meaningful[index];
    if (!token) continue;
    const isSubquery = token.type === "open" && (isWord(meaningful[index + 1], "SELECT") || isWord(meaningful[index + 1], "WITH"));
    if (!isSubquery) {
      run.push(token);
      continue;
    }
    run.push(token); // "("까지 이어 쓰고
    appendRun();
    const closeIndex = findMatchingClose(meaningful, index);
    const inner = meaningful.slice(index + 1, closeIndex >= 0 ? closeIndex : meaningful.length);
    const subqueryColumn = currentColumn();
    const subqueryLines = formatQuery(inner, subqueryColumn, context); // 서브쿼리를 "(" 다음 열에서 다시 정리
    const line = lastLine(fragment);
    const [firstSubqueryLine, ...otherSubqueryLines] = subqueryLines;
    line.text += firstSubqueryLine?.text.slice(subqueryColumn) ?? "";
    line.comments.push(...(firstSubqueryLine?.comments ?? []));
    fragment.push(...otherSubqueryLines);
    if (closeIndex < 0) break;
    const closeToken = meaningful[closeIndex];
    if (closeToken) {
      lastLine(fragment).text += closeToken.display;
      previous = closeToken;
    }
    index = closeIndex;
  }
  appendRun();
  return fragment;
};

/** 목록 항목을 그리는 방법(기본은 renderExpression) */
type ItemRenderer = (item: FormatToken[], column: number) => Fragment;

/**
 * 쉼표 목록을 줄로 만든다.
 *   firstPrefix: 첫 항목 앞에 올 글자(들여쓰기·키워드 포함), itemColumn: 항목이 놓일 절대 열
 *   한 줄에 하나(stackLists)면 항목마다 줄을 바꾸고, 쉼표는 옵션에 따라 항목 뒤/앞에 둔다.
 */
const renderList = (
  items: FormatToken[][],
  firstPrefix: string,
  itemColumn: number,
  role: CommentRole | undefined,
  context: FormatContext,
  { alignAliases = false, renderItem }: { alignAliases?: boolean; renderItem?: ItemRenderer } = {},
): OutputLine[] => {
  const { commaPosition, stackLists } = context.options;
  const drawItem: ItemRenderer = renderItem ?? ((item, column) => renderExpression(item, column, context));

  // 별칭이 있는 항목은 표현식과 별칭을 따로 그려 두었다가, 별칭 열을 맞춰 붙인다.
  const rendered = items.map((item) => {
    const { expression, aliasTokens } = alignAliases ? splitSelectAlias(item) : { expression: item, aliasTokens: [] };
    return { item, fragment: drawItem(expression, itemColumn), aliasText: aliasTokens.length > 0 ? joinTokens(aliasTokens) : "" };
  });
  /** 조각 마지막 줄이 항목 열에서 얼마나 긴지(첫 줄은 들여쓰기가 없으므로 그대로) */
  const lastLineWidth = (fragment: Fragment): number => (fragment.length === 1 ? (fragment[0]?.text.length ?? 0) : lastLine(fragment).text.length - itemColumn);
  const aliasColumn = Math.max(0, ...rendered.filter((entry) => entry.aliasText).map((entry) => lastLineWidth(entry.fragment)));
  for (const entry of rendered) {
    if (!entry.aliasText) continue;
    const padding = stackLists && context.options.alignAliases ? aliasColumn - lastLineWidth(entry.fragment) + 1 : 1;
    lastLine(entry.fragment).text += `${spaces(padding)}${entry.aliasText}`;
  }

  if (!stackLists) {
    // 한 줄에 모두: "a, b, c" (여러 줄 항목이면 그 마지막 줄에 이어 쓴다)
    const lines = placeFragment(firstPrefix, rendered[0]?.fragment ?? [{ text: "", comments: [] }], itemComments(role, rendered[0]?.item ?? [], context));
    for (const entry of rendered.slice(1)) {
      const line = lastLine(lines);
      const [first, ...rest] = entry.fragment;
      line.text += `, ${first?.text ?? ""}`;
      line.comments.push(...itemComments(role, entry.item, context), ...(first?.comments ?? []));
      lines.push(...rest);
    }
    return lines;
  }

  const commaPrefix = commaPosition === "BEFORE" ? "," : commaPosition === "BEFORE_SPACE" ? ", " : "";
  const lines: OutputLine[] = [];
  rendered.forEach((entry, position) => {
    const isFirst = position === 0;
    const prefix = isFirst ? firstPrefix : `${spaces(itemColumn - commaPrefix.length)}${commaPrefix}`;
    const itemLines = placeFragment(prefix, entry.fragment, itemComments(role, entry.item, context));
    if (commaPosition === "AFTER" && position < rendered.length - 1) lastLine(itemLines).text += ",";
    lines.push(...itemLines);
  });
  return lines;
};

/** "(a, b, c)" 괄호 목록을 dpriver처럼 한 줄에 하나씩 펼친다. 괄호 뒤 글자(; 등)는 마지막 줄에 붙인다. */
const renderParenthesizedList = (tokens: FormatToken[], column: number, context: FormatContext): Fragment => {
  const meaningful = withoutComments(tokens);
  const closeIndex = meaningful[0]?.type === "open" ? findMatchingClose(meaningful, 0) : -1;
  if (closeIndex < 0 || !context.options.stackLists) return renderExpression(meaningful, column, context);
  const items = splitByCommas(meaningful.slice(1, closeIndex));
  const [first, ...rest] = renderList(items, "", column + 1, undefined, context);
  const fragment: Fragment = [{ text: `(${first?.text ?? ""}`, comments: first?.comments ?? [] }, ...rest];
  lastLine(fragment).text += `)${joinTokens(meaningful.slice(closeIndex + 1))}`;
  return fragment;
};

/** RIVER 키워드 칸: "FROM   ", "GROUP  BY ", "SELECT " — 첫 낱말을 7칸에 맞춘다. */
const riverKeywordPrefix = (keywordTokens: FormatToken[]): string => {
  const [first, ...rest] = keywordTokens.map((token) => token.display);
  const head = (first ?? "").length >= RIVER_KEYWORD_WIDTH - 1 ? `${first ?? ""} ` : (first ?? "").padEnd(RIVER_KEYWORD_WIDTH);
  return `${head}${rest.map((word) => `${word} `).join("")}`;
};

/**
 * 키워드 + 내용이 있는 절의 시작 모양을 정한다.
 *   RIVER : "FROM   " 뒤 같은 줄에서 내용 시작
 *   INDENT: 항목이 여러 개인 목록은 키워드만 한 줄, 내용은 다음 줄부터 N칸 안쪽 / 그 밖에는 "WHERE " 뒤 같은 줄
 */
const clauseStart = (keywordTokens: FormatToken[], base: number, context: FormatContext, keywordOnItsOwnLine: boolean): { headLines: OutputLine[]; firstPrefix: string; contentColumn: number } => {
  if (context.options.layout === "RIVER") {
    const firstPrefix = `${spaces(base)}${riverKeywordPrefix(keywordTokens)}`;
    return { headLines: [], firstPrefix, contentColumn: firstPrefix.length };
  }
  const keywordText = keywordTokens.map((token) => token.display).join(" ");
  if (keywordOnItsOwnLine) {
    const contentColumn = base + context.options.indentSize;
    return { headLines: [{ text: `${spaces(base)}${keywordText}`, comments: [] }], firstPrefix: spaces(contentColumn), contentColumn };
  }
  const firstPrefix = `${spaces(base)}${keywordText} `;
  return { headLines: [], firstPrefix, contentColumn: firstPrefix.length };
};

/** 절 하나를 줄로 만든다. base는 이 문장의 시작 열(서브쿼리면 "(" 다음 열)이다. */
const renderClause = (clause: SqlClause, base: number, context: FormatContext): OutputLine[] => {
  const { keyword, body } = clause;
  const { layout, indentSize, stackLists } = context.options;

  // 키워드 없이 시작한 부분(WITH ... 등)이나 주석만 있는 줄
  if (!keyword || keyword === ";") {
    const lines: OutputLine[] = keyword === ";" ? [{ text: "", comments: [], blank: true }] : [];
    if (body.length === 0) return lines;
    if (withoutComments(body).length === 0) return [...lines, { text: spaces(base), comments: commentsOf(body) }];
    return [...lines, ...placeFragment(spaces(base), renderExpression(body, base, context), commentsOf(body))];
  }

  if (keyword === "UNION" || keyword === "UNION ALL") {
    return [{ text: `${spaces(base)}${clause.keywordTokens.map((token) => token.display).join(" ")}`, comments: commentsOf(body) }];
  }

  if (listClauses.has(keyword)) {
    // SELECT DISTINCT의 DISTINCT는 키워드 쪽에 붙인다.
    const firstIndex = body.findIndex((token) => token.type !== "comment");
    const hasModifier = keyword === "SELECT" && (isWord(body[firstIndex], "DISTINCT") || isWord(body[firstIndex], "ALL"));
    const modifierTokens = hasModifier ? body.slice(firstIndex, firstIndex + 1) : [];
    const items = splitByCommas(hasModifier ? [...body.slice(0, firstIndex), ...body.slice(firstIndex + 1)] : body);
    const role: CommentRole | undefined = keyword === "FROM" ? "table" : keyword === "SELECT" ? "column" : keyword === "SET" ? "set" : undefined;
    const { headLines, firstPrefix, contentColumn } = clauseStart([...clause.keywordTokens, ...modifierTokens], base, context, stackLists && items.length > 1);
    return [...headLines, ...renderList(items, firstPrefix, contentColumn, role, context, { alignAliases: keyword === "SELECT" })];
  }

  if (keyword.endsWith("JOIN")) {
    // RIVER: JOIN은 FROM 내용 열(7칸), ON은 JOIN보다 7칸 더 / INDENT: JOIN N칸, ON 2N칸
    const joinColumn = layout === "RIVER" ? base + RIVER_KEYWORD_WIDTH : base + indentSize;
    const tracker = createDepthTracker();
    const onIndex = body.findIndex((token) => tracker.visit(token) && isWord(token, "ON"));
    const tableTokens = onIndex >= 0 ? body.slice(0, onIndex) : body;
    const joinPrefix = `${spaces(joinColumn)}${clause.keywordTokens.map((token) => token.display).join(" ")} `;
    const lines = placeFragment(joinPrefix, renderExpression(tableTokens, joinPrefix.length, context), itemComments("table", tableTokens, context));
    if (onIndex < 0) return lines;
    const onColumn = layout === "RIVER" ? joinColumn + RIVER_KEYWORD_WIDTH : base + indentSize * 2;
    const [firstCondition = [], ...otherConditions] = splitByLogical(body.slice(onIndex + 1));
    const onPrefix = `${spaces(onColumn)}${body[onIndex]?.display ?? "ON"} `;
    lines.push(...placeFragment(onPrefix, renderExpression(firstCondition, onPrefix.length, context), commentsOf(firstCondition)));
    otherConditions.forEach((condition) => lines.push(...renderLogicalLine(condition, onPrefix.length, onColumn, context)));
    return lines;
  }

  if (conditionClauses.has(keyword)) {
    const { firstPrefix, contentColumn } = clauseStart(clause.keywordTokens, base, context, false);
    const [firstCondition = [], ...otherConditions] = splitByLogical(body);
    const lines = placeFragment(firstPrefix, renderExpression(firstCondition, contentColumn, context), commentsOf(firstCondition));
    const keywordColumn = layout === "INDENT" ? base + indentSize : base;
    otherConditions.forEach((condition) => lines.push(...renderLogicalLine(condition, contentColumn, keywordColumn, context)));
    return lines;
  }

  if (keyword === "INSERT INTO" && layout === "RIVER") {
    // INSERT INTO t 다음 줄에 칼럼 목록을 "INSERT INTO " 너비에 맞춰 한 줄에 하나씩(dpriver 모양)
    const openIndex = body.findIndex((token) => token.type === "open");
    const tableTokens = openIndex >= 0 ? body.slice(0, openIndex) : body;
    const lines: OutputLine[] = [{ text: `${spaces(base)}${riverKeywordPrefix(clause.keywordTokens)}${joinTokens(tableTokens)}`, comments: itemComments("table", tableTokens, context) }];
    if (openIndex < 0) return lines;
    const listColumn = base + RIVER_INSERT_LIST_WIDTH;
    return [...lines, ...placeFragment(spaces(listColumn), renderParenthesizedList(body.slice(openIndex), listColumn, context))];
  }

  if (keyword === "VALUES") {
    // 여러 행 VALUES (..), (..)는 행마다 줄을 바꾼다. RIVER는 INSERT 칼럼 목록과 같은 열에 맞춘다.
    const valuesWord = clause.keywordTokens[0]?.display ?? "VALUES";
    const rows = splitByCommas(body);
    if (layout === "RIVER") {
      const listColumn = base + RIVER_INSERT_LIST_WIDTH;
      const firstPrefix = `${spaces(base)}${valuesWord.padEnd(RIVER_INSERT_LIST_WIDTH)}`;
      return renderList(rows, firstPrefix, listColumn, undefined, context, { renderItem: (row, column) => renderParenthesizedList(row, column, context) });
    }
    const { headLines, firstPrefix, contentColumn } = clauseStart(clause.keywordTokens, base, context, stackLists && rows.length > 1);
    return [...headLines, ...renderList(rows, firstPrefix, contentColumn, undefined, context)];
  }

  // 그 밖(UPDATE, DELETE FROM, INSERT INTO(INDENT), LIMIT, OFFSET): 키워드 뒤에 한 줄로
  const { firstPrefix, contentColumn } = clauseStart(clause.keywordTokens, base, context, false);
  const role = tableClauses.has(keyword) ? "table" : undefined;
  return placeFragment(firstPrefix, renderExpression(body, contentColumn, context), itemComments(role, body, context));
};

/** 문장(여러 문장도 가능)을 정리한다. 서브쿼리는 이 함수를 다시 부른다(재귀). */
const formatQuery = (tokens: FormatToken[], base: number, context: FormatContext): OutputLine[] => {
  // 문장(;)마다 따로 나눠, 별칭 지도가 다른 문장과 섞이지 않게 한다.
  // (앞 SELECT의 테이블 때문에 뒤 UPDATE의 칼럼이 "두 테이블에 다 있는 칼럼"으로 보이는 일을 막는다)
  const statements: SqlClause[][] = [[]];
  for (const clause of splitClauses(tokens)) {
    statements[statements.length - 1]?.push(clause);
    if (clause.keyword === ";") statements.push([]);
  }
  return statements.flatMap((clauses) => {
    // 서브쿼리 안에서는 바깥 쿼리 별칭 + 자기 별칭을 함께 본다.
    const localContext: FormatContext = { ...context, aliases: new Map([...context.aliases, ...collectTableAliases(clauses)]) };
    return clauses.flatMap((clause) => renderClause(clause, base, localContext));
  });
};

/** 한글 같은 넓은 글자는 고정폭 글꼴에서 두 칸을 차지하므로 주석 열을 맞출 때 2로 센다. */
const displayWidth = (text: string): number =>
  [...text].reduce((width, character) => width + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(character) ? 2 : 1), 0);

const formatComment = (comment: string, style: SqlCommentStyle): string =>
  style === "SQL" ? `-- ${comment}` : `/* ${comment.replace(/\*\//g, "* /")} */`; // 코멘트 안의 */는 주석을 끝내 버리므로 띄운다

/** 줄 끝 주석을 한 열로 맞춰 최종 글자를 만든다. */
const renderOutput = (lines: OutputLine[], style: SqlCommentStyle): string => {
  const codeLines = lines.map((line) => ({ ...line, text: line.text.replace(/\s+$/, "") }));
  const commentColumn = Math.min(
    MAX_COMMENT_COLUMN,
    Math.max(0, ...codeLines.filter((line) => line.comments.length > 0 && line.text.trim()).map((line) => displayWidth(line.text))) + 1,
  );
  return codeLines
    .map((line) => {
      if (line.blank) return "";
      if (line.comments.length === 0) return line.text;
      const comment = formatComment(line.comments.join(" / "), style);
      if (!line.text.trim()) return `${line.text}${comment}`; // 주석만 있는 줄
      return `${line.text}${spaces(Math.max(1, commentColumn - displayWidth(line.text)))}${comment}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/** SQL을 정리한다. 옵션은 바꾸고 싶은 것만 넘기면 나머지는 dpriver 기본값을 쓴다. */
export const formatSqlWithComments = (source: string, partialOptions: Partial<SqlFormatOptions> = {}): SqlFormatResult => {
  const merged = { ...defaultSqlFormatOptions, ...partialOptions };
  const options: SqlFormatOptions = { ...merged, indentSize: Math.min(SQL_INDENT_RANGE.max, Math.max(SQL_INDENT_RANGE.min, Math.round(merged.indentSize))) };
  const tokens = annotateTokens(tokenizeSql(source), options);
  if (tokens.length === 0) return { text: "", addedCommentCount: 0 };
  const context: FormatContext = { options, aliases: new Map(), stats: { addedCommentCount: 0 } };
  const text = renderOutput(formatQuery(tokens, 0, context), options.commentStyle);
  return { text, addedCommentCount: context.stats.addedCommentCount };
};
