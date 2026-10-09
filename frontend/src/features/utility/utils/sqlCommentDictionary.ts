/**
 * ============================================================================
 * sqlCommentDictionary.ts — "테이블·칼럼 코멘트" 입력을 읽어 찾아보기 쉬운 사전으로 만든다
 * ============================================================================
 *
 * 쿼리에 붙일 주석의 재료다. 세 가지 입력 형식을 받는다(섞어 쓰지 않는다).
 *
 *   1) 한 줄에 하나 (공백 또는 탭으로 구분)
 *        users        유저테이블        ← 점(.)이 없는 이름: 테이블 코멘트, 또는 별칭·칼럼 이름 코멘트
 *        users.id     유저아이디        ← 테이블.칼럼
 *        orders_count 유저수            ← SELECT의 "AS 별칭" 이름에도 쓸 수 있다
 *      DB 도구에서 복사한 탭 구분 3칸(테이블 ⇥ 칼럼 ⇥ 코멘트)도 그대로 붙여 넣으면 된다.
 *
 *   2) MySQL DDL:  CREATE TABLE users ( id BIGINT COMMENT '유저아이디', ... ) COMMENT='유저테이블';
 *   3) Oracle·PostgreSQL:  COMMENT ON COLUMN users.id IS '유저아이디';  COMMENT ON TABLE users IS '유저테이블';
 *
 * 이름은 대소문자·따옴표(`, ")를 무시하고 비교한다(users = USERS = `users`).
 */
import { tokenizeSql, type SqlToken } from "@/features/utility/utils/sqlTokenizer";

export interface SqlCommentDictionary {
  /** 점 없는 이름 → 코멘트. 테이블 코멘트이자, 별칭·테이블을 모르는 칼럼 이름의 코멘트로도 쓴다. */
  names: Map<string, string>;
  /** 테이블 → (칼럼 → 코멘트) */
  columns: Map<string, Map<string, string>>;
}

/** 이름 비교용: 따옴표 제거 + 소문자. "`Users`" → "users" */
export const normalizeSqlName = (name: string): string => name.replace(/^[`"[]|[`"\]]$/g, "").toLowerCase();

export const createEmptyCommentDictionary = (): SqlCommentDictionary => ({ names: new Map(), columns: new Map() });

export const countDictionaryEntries = (dictionary: SqlCommentDictionary): number =>
  dictionary.names.size + [...dictionary.columns.values()].reduce((total, columnComments) => total + columnComments.size, 0);

const addColumnComment = (dictionary: SqlCommentDictionary, table: string, column: string, comment: string): void => {
  const tableKey = normalizeSqlName(table);
  const columnComments = dictionary.columns.get(tableKey) ?? new Map<string, string>();
  columnComments.set(normalizeSqlName(column), comment);
  dictionary.columns.set(tableKey, columnComments);
};

/** "users.id"면 칼럼 코멘트, "schema.users.id"면 마지막 두 조각을, "users"처럼 점이 없으면 이름 코멘트로 넣는다. */
const addNamedComment = (dictionary: SqlCommentDictionary, name: string, comment: string): void => {
  const cleanComment = comment.trim().replace(/^'(.*)'$/, "$1");
  if (!cleanComment) return;
  const segments = name.split(".").filter(Boolean);
  const column = segments.at(-1);
  const table = segments.at(-2);
  if (table && column) addColumnComment(dictionary, table, column, cleanComment);
  else if (column) dictionary.names.set(normalizeSqlName(column), cleanComment);
};

/** 형식 1: 한 줄에 하나. 탭이 있으면 탭으로, 없으면 "첫 낱말 = 이름, 나머지 = 코멘트"로 나눈다. */
const parseLines = (text: string, dictionary: SqlCommentDictionary): void => {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue; // 빈 줄과 # 메모 줄은 건너뛴다
    if (line.includes("\t")) {
      const parts = line.split("\t").map((part) => part.trim()).filter(Boolean);
      const [first, second, ...rest] = parts;
      if (first && second && rest.length > 0) addColumnComment(dictionary, first, second, rest.join(" ").replace(/^'(.*)'$/, "$1"));
      else if (first && second) addNamedComment(dictionary, first, second);
      continue;
    }
    const match = /^(\S+)\s+(.+)$/.exec(line);
    if (match?.[1] && match[2]) addNamedComment(dictionary, match[1], match[2]);
  }
};

/** 'a''b' → a'b (SQL 문자열의 작은따옴표 두 개는 작은따옴표 하나다) */
const unquoteSqlString = (text: string): string => text.replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'");

const isWord = (token: SqlToken | undefined, word: string): boolean => token?.type === "word" && token.text.toUpperCase() === word;

/** tokens[index]부터 "a.b.c" 형태의 이름을 읽고, 이름 조각들과 다음 위치를 돌려준다. */
const readQualifiedName = (tokens: SqlToken[], startIndex: number): { segments: string[]; nextIndex: number } => {
  const segments: string[] = [];
  let index = startIndex;
  while (tokens[index]?.type === "word") {
    segments.push(tokens[index]?.text ?? "");
    if (tokens[index + 1]?.type !== "dot") return { segments, nextIndex: index + 1 };
    index += 2;
  }
  return { segments, nextIndex: index };
};

// 칼럼 정의가 아닌 줄(제약 조건·인덱스)의 첫 낱말
const constraintWords = new Set(["PRIMARY", "KEY", "INDEX", "UNIQUE", "CONSTRAINT", "FOREIGN", "FULLTEXT", "SPATIAL", "CHECK"]);

/** 형식 2: CREATE TABLE 이름 ( 칼럼 ... COMMENT '...', ... ) COMMENT='...' */
const parseCreateTable = (tokens: SqlToken[], startIndex: number, dictionary: SqlCommentDictionary): number => {
  let index = startIndex + 2; // CREATE TABLE 다음
  if (isWord(tokens[index], "IF") && isWord(tokens[index + 1], "NOT") && isWord(tokens[index + 2], "EXISTS")) index += 3;
  const { segments, nextIndex } = readQualifiedName(tokens, index);
  const table = segments.at(-1);
  index = nextIndex;
  if (!table || tokens[index]?.type !== "open") return index;

  // 괄호 안을 깊이 1의 쉼표로 나눠 칼럼 정의 하나씩 본다. DECIMAL(10,2)의 쉼표는 깊이 2라 나누지 않는다.
  let depth = 0;
  let definition: SqlToken[] = [];
  const readDefinition = (): void => {
    const [nameToken] = definition;
    const commentIndex = definition.findIndex((token) => isWord(token, "COMMENT"));
    const commentToken = commentIndex >= 0 ? definition[commentIndex + 1] : undefined;
    if (nameToken?.type === "word" && !constraintWords.has(nameToken.text.toUpperCase()) && commentToken?.type === "string") {
      addColumnComment(dictionary, table, nameToken.text, unquoteSqlString(commentToken.text));
    }
    definition = [];
  };
  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) break;
    if (token.type === "open") depth += 1;
    if (token.type === "close") depth -= 1;
    if (depth === 0) break; // 테이블 정의 괄호가 닫혔다
    if (depth === 1 && token.type === "comma") readDefinition();
    else if (!(depth === 1 && token.type === "open")) definition.push(token);
  }
  readDefinition();

  // 닫는 괄호 뒤 테이블 옵션에서 COMMENT[=]'...'를 찾는다(다음 문장 ; 전까지).
  for (index += 1; index < tokens.length && tokens[index]?.type !== "semicolon"; index += 1) {
    if (!isWord(tokens[index], "COMMENT")) continue;
    const valueToken = tokens[index + 1]?.text === "=" ? tokens[index + 2] : tokens[index + 1];
    if (valueToken?.type === "string") dictionary.names.set(normalizeSqlName(table), unquoteSqlString(valueToken.text));
  }
  return index;
};

/** 형식 3: COMMENT ON TABLE 이름 IS '...' / COMMENT ON COLUMN 테이블.칼럼 IS '...' */
const parseCommentOn = (tokens: SqlToken[], startIndex: number, dictionary: SqlCommentDictionary): number => {
  const target = tokens[startIndex + 2]?.text.toUpperCase();
  const { segments, nextIndex } = readQualifiedName(tokens, startIndex + 3);
  const valueToken = isWord(tokens[nextIndex], "IS") ? tokens[nextIndex + 1] : undefined;
  if (valueToken?.type !== "string") return nextIndex;
  const comment = unquoteSqlString(valueToken.text);
  const table = segments.at(target === "COLUMN" ? -2 : -1);
  const column = segments.at(-1);
  if (target === "TABLE" && table) dictionary.names.set(normalizeSqlName(table), comment);
  if (target === "COLUMN" && table && column) addColumnComment(dictionary, table, column, comment);
  return nextIndex + 2;
};

/** 입력 글을 읽어 코멘트 사전을 만든다. DDL(CREATE TABLE·COMMENT ON)이 보이면 DDL로, 아니면 한 줄 형식으로 읽는다. */
export const parseSqlCommentDictionary = (text: string): SqlCommentDictionary => {
  const dictionary = createEmptyCommentDictionary();
  if (!/\bCREATE\s+TABLE\b|\bCOMMENT\s+ON\b/i.test(text)) {
    parseLines(text, dictionary);
    return dictionary;
  }
  const tokens = tokenizeSql(text).filter((token) => token.type !== "comment");
  for (let index = 0; index < tokens.length; index += 1) {
    if (isWord(tokens[index], "CREATE") && isWord(tokens[index + 1], "TABLE")) index = parseCreateTable(tokens, index, dictionary);
    else if (isWord(tokens[index], "COMMENT") && isWord(tokens[index + 1], "ON")) index = parseCommentOn(tokens, index, dictionary);
  }
  return dictionary;
};
