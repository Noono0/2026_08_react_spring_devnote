/**
 * ============================================================================
 * sqlTokenizer.ts — SQL 문자열을 "토큰"(의미 있는 조각) 배열로 나눈다
 * ============================================================================
 *
 * 예) "select u.id, 'a b' from users -- 유저"
 *   → [word select] [word u] [dot] [word id] [comma] [string 'a b'] [word from] [word users] [comment 유저]
 *
 * ★ 왜 토큰으로 나누나?
 *   정규식으로 문자열 전체를 바로 치환하면 'from' 같은 글자가 문자열('...')이나 주석 안에 있어도
 *   키워드로 착각한다. 먼저 문자열·주석·괄호를 구분해 두면, 그 뒤 단계(sqlFormatter.ts)는
 *   "진짜 키워드인지", "괄호 안인지(깊이)"를 안전하게 판단할 수 있다.
 *
 * newlineBefore: 이 토큰 앞에 줄바꿈이 있었는지. 주석이 "앞 줄 끝에 붙은 주석"인지
 *   "자기 줄에 따로 있는 주석"인지 구분할 때 쓴다.
 */

export type SqlTokenType = "word" | "string" | "comment" | "open" | "close" | "comma" | "semicolon" | "dot" | "symbol";

export interface SqlToken {
  type: SqlTokenType;
  text: string; // comment는 --, /* */를 뺀 내용만 담는다
  newlineBefore: boolean;
}

/**
 * 앞에서부터 순서대로 맞춰 보는 규칙. 순서가 중요하다.
 *   - 주석(--, /*)을 기호(-, /)보다 먼저 검사해야 "-- 주석"이 빼기 기호로 잘리지 않는다.
 *   - MyBatis 파라미터 #{id}, ${id}는 한 덩어리 단어로 본다.
 */
const tokenRules: Array<{ type: SqlTokenType | "space"; pattern: RegExp }> = [
  { type: "space", pattern: /^\s+/ },
  { type: "comment", pattern: /^--[^\n]*/ },
  { type: "comment", pattern: /^\/\*[^]*?(?:\*\/|$)/ },
  { type: "string", pattern: /^'(?:[^']|'')*'?/ },
  { type: "word", pattern: /^"(?:[^"]|"")*"?/ }, // "따옴표 식별자"
  { type: "word", pattern: /^`[^`]*`?/ }, // `MySQL 식별자`
  { type: "word", pattern: /^[#$]\{[^}]*\}?/ }, // MyBatis #{param}, ${param}
  { type: "word", pattern: /^[\w$@:?]+/ },
  { type: "open", pattern: /^\(/ },
  { type: "close", pattern: /^\)/ },
  { type: "comma", pattern: /^,/ },
  { type: "semicolon", pattern: /^;/ },
  { type: "dot", pattern: /^\./ },
  { type: "symbol", pattern: /^(?:<>|<=|>=|!=|\|\||::|[^\s\w])/ },
];

/** 주석 기호를 떼고 안쪽 글자만 남긴다. "-- 유저" → "유저", "/* 유저 *\/" → "유저" */
const stripCommentMarks = (commentText: string): string =>
  commentText.startsWith("--") ? commentText.slice(2).trim() : commentText.replace(/^\/\*/, "").replace(/\*\/$/, "").trim();

export const tokenizeSql = (source: string): SqlToken[] => {
  const tokens: SqlToken[] = [];
  let rest = source;
  let newlineBefore = false;
  while (rest.length > 0) {
    const rule = tokenRules.find((candidate) => candidate.pattern.test(rest));
    // 마지막 규칙([^\s\w])이 공백·글자가 아닌 모든 한 글자를 받으므로 rule이 없을 수는 없지만, 안전하게 한 글자씩 넘긴다.
    const matchedText = rule ? (rule.pattern.exec(rest)?.[0] ?? rest.charAt(0)) : rest.charAt(0);
    if (rule?.type === "space") {
      if (matchedText.includes("\n")) newlineBefore = true;
    } else {
      const type: SqlTokenType = rule ? rule.type : "symbol"; // 위 if에서 "space"는 이미 걸러졌다
      tokens.push({ type, text: type === "comment" ? stripCommentMarks(matchedText) : matchedText, newlineBefore });
      newlineBefore = false;
    }
    rest = rest.slice(matchedText.length);
  }
  return tokens;
};
