/**
 * ============================================================================
 * sqlFormatter.ts — SQL 정리(들여쓰기) + 테이블·칼럼 코멘트를 주석으로 붙이기
 * ============================================================================
 *
 * [결과 모양] (들여쓰기 4칸, SQL 주석)
 *   SELECT
 *       u.id,              -- 유저아이디
 *       u.name             -- 유저이름
 *   FROM users u           -- 유저테이블
 *       LEFT JOIN orders o -- 주문테이블
 *           ON o.user_id = u.id
 *   WHERE u.created_at > '2024-01-01'
 *       AND u.status IN ('active', 'trial')
 *
 * [처리 순서]
 *   1) sqlTokenizer로 토큰을 만든다(문자열·주석·괄호를 구분).
 *   2) 괄호 밖(깊이 0)의 큰 키워드(SELECT, FROM, JOIN, WHERE ...)로 "절(clause)"을 나눈다.
 *      괄호 안(서브쿼리·함수 인자)은 나누지 않고 한 줄로 둔다.
 *   3) 절마다 줄을 만든다. SELECT·GROUP BY 목록은 쉼표마다, WHERE·ON 조건은 AND/OR마다 줄을 바꾼다.
 *   4) FROM·JOIN의 "테이블 별칭"을 모아(u → users) SELECT 칼럼(u.id)이 어느 테이블 칼럼인지 찾아 코멘트를 붙인다.
 *   5) 주석 위치를 한 열로 맞춰 출력한다. SQL은 "-- 코멘트", MyBatis는 "/* 코멘트 *\/".
 *      (MyBatis XML에서는 줄이 합쳐질 때 -- 뒤가 모두 주석이 되어 버릴 수 있어 /* *\/를 쓴다)
 *
 * ★ 원래 쿼리에 있던 주석은 그 줄 끝으로 옮겨 그대로 두고, 이미 주석이 있는 줄에는 코멘트를 새로 붙이지 않는다.
 *   그래서 결과를 다시 정리해도 주석이 두 번 붙지 않는다.
 * ★ 학습용 경량 정리기다. 서브쿼리 안쪽 정리, MyBatis 동적 태그(<if> 등), DB별 특수 문법은 지원하지 않는다.
 */
import { normalizeSqlName, type SqlCommentDictionary } from "@/features/utility/utils/sqlCommentDictionary";
import { tokenizeSql, type SqlToken } from "@/features/utility/utils/sqlTokenizer";

export type SqlCommentStyle = "SQL" | "MYBATIS";

export interface SqlFormatOptions {
  indentSize: number; // 들여쓰기 칸 수(1~10)
  uppercase: boolean; // 키워드 대문자
  commentStyle: SqlCommentStyle;
  dictionary?: SqlCommentDictionary; // 없으면 코멘트를 붙이지 않는다
}

export interface SqlFormatResult {
  text: string;
  addedCommentCount: number; // 코멘트 사전에서 찾아 새로 붙인 주석 수
}

export const SQL_INDENT_RANGE = { min: 1, max: 10, initial: 4 } as const;

/** 대소문자를 맞출 키워드. 함수 이름(COUNT, SUM ...)은 사용자가 쓴 그대로 둔다. */
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
const listClauses = new Set(["SELECT", "FROM", "GROUP BY", "ORDER BY", "SET", "VALUES"]);
/** AND/OR마다 줄을 바꾸는 절 */
const conditionClauses = new Set(["WHERE", "HAVING"]);
/** 테이블 이름이 오는 절(별칭 모으기·테이블 코멘트) */
const tableClauses = new Set(["UPDATE", "INSERT INTO", "DELETE FROM"]);

interface SqlClause {
  keyword: string; // "LEFT JOIN"처럼 대문자로 이은 구. 키워드 없이 시작한 앞부분은 ""
  keywordTokens: SqlToken[];
  body: SqlToken[];
}

/** 코멘트를 어떤 기준으로 찾을지: 테이블 줄, SELECT 칼럼 줄, SET(칼럼 = 값) 줄 */
type LineRole = "table" | "column" | "set";

interface SqlLine {
  depth: number; // 들여쓰기 단계(칸 수 = depth × indentSize)
  tokens: SqlToken[]; // 화면에 쓸 토큰(주석 제외)
  comments: string[]; // 원래 쿼리에 있던 주석
  role?: LineRole;
  itemTokens?: SqlToken[]; // 코멘트를 찾을 때 볼 부분(키워드 제외)
  blank?: boolean; // 문장(;) 사이 빈 줄
}

const isWord = (token: SqlToken | undefined, word: string): boolean => token?.type === "word" && token.text.toUpperCase() === word;
const isKeyword = (token: SqlToken | undefined): boolean => token?.type === "word" && sqlKeywords.has(token.text.toUpperCase());

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

/** tokens[index]에서 시작하는 절 키워드 구를 찾는다(괄호 밖에서만 호출). */
const matchClausePhrase = (tokens: SqlToken[], index: number): string[] | undefined =>
  clausePhrases.find((phrase) => phrase.every((word, offset) => isWord(tokens[index + offset], word)));

/**
 * 맨 바깥의 절 키워드로 토큰을 절 단위로 나눈다.
 * 자기 줄에 따로 있던 주석(newlineBefore)이 다음 절 키워드 바로 앞에 있으면, 앞 절 끝이 아니라 다음 절에 붙인다.
 */
const splitClauses = (tokens: SqlToken[]): SqlClause[] => {
  const clauses: SqlClause[] = [];
  let current: SqlClause = { keyword: "", keywordTokens: [], body: [] };
  let pendingLeadingComments: SqlToken[] = [];
  const tracker = createDepthTracker();
  const startClause = (clause: SqlClause): void => {
    if (current.keyword || current.body.length > 0) clauses.push(current);
    current = clause;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token.type === "comment" && token.newlineBefore) {
      pendingLeadingComments.push(token); // 다음 토큰이 무엇인지 보고 어디에 붙일지 정한다
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
      const keywordTokens = tokens.slice(index, index + phrase.length);
      startClause({ keyword: phrase.join(" "), keywordTokens, body: pendingLeadingComments });
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

/** 맨 바깥 쉼표로 목록 항목을 나눈다. 쉼표는 앞 항목 끝에 두고, 쉼표 바로 뒤 같은 줄 주석도 앞 항목에 붙인다. */
const splitByCommas = (tokens: SqlToken[]): SqlToken[][] => {
  const items: SqlToken[][] = [];
  let current: SqlToken[] = [];
  const tracker = createDepthTracker();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const isTopLevel = tracker.visit(token);
    current.push(token);
    if (!isTopLevel || token.type !== "comma") continue;
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
const splitByLogical = (tokens: SqlToken[]): SqlToken[][] => {
  const conditions: SqlToken[][] = [];
  let current: SqlToken[] = [];
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

const createLine = (depth: number, tokens: SqlToken[], role?: LineRole, itemTokens?: SqlToken[]): SqlLine => ({
  depth,
  tokens: tokens.filter((token) => token.type !== "comment"),
  comments: tokens.filter((token) => token.type === "comment").map((token) => token.text).filter(Boolean),
  role,
  itemTokens,
});

/** 절 하나를 줄 여러 개로 바꾼다. */
const layoutClause = (clause: SqlClause): SqlLine[] => {
  const { keyword, keywordTokens, body } = clause;
  if (keyword === ";") return [{ depth: 0, tokens: [], comments: [], blank: true }, ...(body.length > 0 ? [createLine(0, body)] : [])];

  if (listClauses.has(keyword)) {
    // SELECT DISTINCT의 DISTINCT는 키워드 줄에 남긴다.
    const leadingModifiers = keyword === "SELECT" && (isWord(body[0], "DISTINCT") || isWord(body[0], "ALL")) ? body.slice(0, 1) : [];
    const items = splitByCommas(body.slice(leadingModifiers.length));
    const role: LineRole | undefined = keyword === "FROM" ? "table" : keyword === "SELECT" ? "column" : keyword === "SET" ? "set" : undefined;
    const [onlyItem] = items;
    // 항목이 하나면 "SELECT *"처럼 한 줄, 여러 개면 키워드 줄 아래에 한 칸 들여 한 줄씩
    if (items.length <= 1) return [createLine(0, [...keywordTokens, ...leadingModifiers, ...(onlyItem ?? [])], role, onlyItem)];
    return [createLine(0, [...keywordTokens, ...leadingModifiers]), ...items.map((item) => createLine(1, item, role, item))];
  }

  if (keyword.endsWith("JOIN")) {
    // JOIN 테이블 줄은 FROM보다 한 칸, ON 조건은 두 칸 들인다.
    const tracker = createDepthTracker();
    const onIndex = body.findIndex((token) => tracker.visit(token) && isWord(token, "ON"));
    const tableTokens = onIndex >= 0 ? body.slice(0, onIndex) : body;
    const conditions = onIndex >= 0 ? splitByLogical(body.slice(onIndex)) : [];
    return [createLine(1, [...keywordTokens, ...tableTokens], "table", tableTokens), ...conditions.map((condition) => createLine(2, condition))];
  }

  if (conditionClauses.has(keyword)) {
    const [firstCondition = [], ...otherConditions] = splitByLogical(body);
    return [createLine(0, [...keywordTokens, ...firstCondition]), ...otherConditions.map((condition) => createLine(1, condition))];
  }

  return [createLine(0, [...keywordTokens, ...body], tableClauses.has(keyword) ? "table" : undefined, body)];
};

// ── 코멘트 찾기 ─────────────────────────────────────────────

/** "users u", "users AS u", "db.users u" → { table: "users", alias: "u" }. 서브쿼리 "(...) t"는 테이블이 아니므로 undefined */
const parseTableReference = (tokens: SqlToken[]): { table: string; alias?: string } | undefined => {
  const meaningful = tokens.filter((token) => token.type !== "comment");
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

/** 쿼리 안의 "별칭 → 테이블" 지도. 테이블 이름 자체로 쓴 경우(users.id)도 찾을 수 있게 테이블 → 테이블도 넣는다. */
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

/** 표현식 안의 칼럼 참조를 찾는다. 함수 이름(COUNT 뒤에 "(")·키워드·숫자·별칭(AS 뒤)은 칼럼이 아니다. */
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

/** SELECT 항목에서 "AS 별칭"(또는 "COUNT(x) cnt"처럼 AS 없는 별칭)과 나머지 표현식을 나눈다. */
const splitSelectAlias = (tokens: SqlToken[]): { expression: SqlToken[]; alias?: string } => {
  const meaningful = tokens.filter((token) => token.type !== "comment" && token.type !== "comma" && token.type !== "semicolon");
  const tracker = createDepthTracker();
  const asIndex = meaningful.findIndex((token) => tracker.visit(token) && isWord(token, "AS"));
  if (asIndex >= 0) return { expression: meaningful.slice(0, asIndex), alias: meaningful[asIndex + 1]?.text };
  const last = meaningful.at(-1);
  const beforeLast = meaningful.at(-2);
  const hasImplicitAlias = last?.type === "word" && !isKeyword(last) && (beforeLast?.type === "word" || beforeLast?.type === "close") && !isKeyword(beforeLast);
  return hasImplicitAlias ? { expression: meaningful.slice(0, -1), alias: last.text } : { expression: meaningful };
};

const createCommentFinder = (dictionary: SqlCommentDictionary, aliases: Map<string, string>) => {
  const tablesInQuery = [...new Set(aliases.values())];

  /** u.id → users.id 코멘트. 별칭이 없는 id는 이 쿼리의 테이블 중 id 칼럼이 딱 하나일 때만 정한다. */
  const findColumnComment = ({ qualifier, column }: ColumnReference): string | undefined => {
    if (qualifier) {
      const table = aliases.get(qualifier) ?? qualifier;
      return dictionary.columns.get(table)?.get(column) ?? dictionary.names.get(column);
    }
    const matches = tablesInQuery.map((table) => dictionary.columns.get(table)?.get(column)).filter((comment): comment is string => comment !== undefined);
    return matches.length === 1 ? matches[0] : dictionary.names.get(column);
  };

  return (line: SqlLine): string | undefined => {
    const itemTokens = line.itemTokens ?? [];
    if (line.role === "table") {
      const reference = parseTableReference(itemTokens);
      return reference ? dictionary.names.get(reference.table) : undefined;
    }
    if (line.role === "column") {
      // 1순위: 별칭 이름(orders_count) 코멘트, 2순위: 표현식 안 칼럼이 하나뿐이면 그 칼럼 코멘트(COUNT(o.id) → o.id)
      const { expression, alias } = splitSelectAlias(itemTokens);
      const aliasComment = alias ? dictionary.names.get(normalizeSqlName(alias)) : undefined;
      if (aliasComment) return aliasComment;
      const references = findColumnReferences(expression);
      const [onlyReference] = references;
      return references.length === 1 && onlyReference ? findColumnComment(onlyReference) : undefined;
    }
    if (line.role === "set") {
      // SET name = ... 의 왼쪽 칼럼
      const equalsIndex = itemTokens.findIndex((token) => token.text === "=");
      const [target] = findColumnReferences(equalsIndex >= 0 ? itemTokens.slice(0, equalsIndex) : itemTokens);
      return target ? findColumnComment(target) : undefined;
    }
    return undefined;
  };
};

// ── 출력 ─────────────────────────────────────────────

/** 토큰을 이어 한 줄 글자로 만든다. 쉼표·닫는 괄호·점 앞, 여는 괄호·점 뒤에는 띄어쓰지 않는다. */
const joinTokens = (tokens: SqlToken[], uppercase: boolean): string => {
  let text = "";
  let previous: SqlToken | undefined;
  let beforePrevious: SqlToken | undefined;
  let previousIsUnarySign = false;
  for (const token of tokens) {
    const isFunctionCall = token.type === "open" && previous?.type === "word" && !isKeyword(previous) && !isWord(beforePrevious, "INTO");
    const noSpace = !previous
      || ["comma", "close", "semicolon", "dot"].includes(token.type)
      || previous.type === "open" || previous.type === "dot" || previousIsUnarySign || isFunctionCall
      || token.text === "::" || previous.text === "::";
    const display = token.type === "word" && isKeyword(token) && previous?.type !== "dot" ? (uppercase ? token.text.toUpperCase() : token.text.toLowerCase()) : token.text;
    text += `${noSpace ? "" : " "}${display}`;
    // -1처럼 부호로 쓰인 -, +는 뒤 숫자와 붙인다(앞이 없거나 연산자·여는 괄호·쉼표·키워드일 때).
    previousIsUnarySign = (token.text === "-" || token.text === "+")
      && (!previous || ["open", "comma", "symbol"].includes(previous.type) || isKeyword(previous));
    beforePrevious = previous;
    previous = token;
  }
  return text;
};

/** 한글 같은 넓은 글자는 고정폭 글꼴에서 두 칸을 차지하므로 주석 열을 맞출 때 2로 센다. */
const displayWidth = (text: string): number =>
  [...text].reduce((width, character) => width + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(character) ? 2 : 1), 0);

const formatComment = (comment: string, style: SqlCommentStyle): string =>
  style === "SQL" ? `-- ${comment}` : `/* ${comment.replace(/\*\//g, "* /")} */`; // 코멘트 안의 */는 주석을 끝내 버리므로 띄운다

/** 이 열보다 긴 줄이 있으면 그 줄만 한 칸 띄우고 붙인다(주석 열이 너무 멀리 밀려나지 않게). */
const MAX_COMMENT_COLUMN = 80;

export const formatSqlWithComments = (source: string, options: SqlFormatOptions): SqlFormatResult => {
  const tokens = tokenizeSql(source);
  if (tokens.length === 0) return { text: "", addedCommentCount: 0 };
  const clauses = splitClauses(tokens);
  const lines = clauses.flatMap(layoutClause);
  const findComment = options.dictionary ? createCommentFinder(options.dictionary, collectTableAliases(clauses)) : undefined;
  const indentSize = Math.min(SQL_INDENT_RANGE.max, Math.max(SQL_INDENT_RANGE.min, Math.round(options.indentSize)));

  let addedCommentCount = 0;
  const rendered = lines.map((line) => {
    // 원래 있던 주석이 우선이다. 없을 때만 사전에서 찾아 붙인다.
    const autoComment = line.comments.length === 0 && findComment ? findComment(line) : undefined;
    if (autoComment) addedCommentCount += 1;
    return { blank: line.blank === true, code: `${" ".repeat(line.depth * indentSize)}${joinTokens(line.tokens, options.uppercase)}`, comments: autoComment ? [autoComment] : line.comments, hasCode: line.tokens.length > 0 };
  });

  const commentColumn = Math.min(
    MAX_COMMENT_COLUMN,
    Math.max(0, ...rendered.filter((line) => line.comments.length > 0 && line.hasCode).map((line) => displayWidth(line.code))) + 1,
  );
  const text = rendered
    .map((line) => {
      if (line.blank) return "";
      if (line.comments.length === 0) return line.code;
      const comment = formatComment(line.comments.join(" / "), options.commentStyle);
      if (!line.hasCode) return `${line.code}${comment}`; // 주석만 있는 줄
      const padding = Math.max(1, commentColumn - displayWidth(line.code));
      return `${line.code}${" ".repeat(padding)}${comment}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, addedCommentCount };
};
