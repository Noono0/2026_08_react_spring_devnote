/**
 * ============================================================================
 * sourceFormatter.ts — 코드 정리(포맷)와 압축(minify)
 * ============================================================================
 *
 * 로그에서 복사한 한 줄짜리 JSON이나 SQL을 읽기 좋게 펴 주는 도구다.
 *
 * ★★ 먼저 알아야 할 한계
 *   이건 Prettier 같은 진짜 포맷터가 아니다.
 *   진짜 포맷터는 코드를 문법 트리(AST)로 파싱한 뒤 다시 출력한다.
 *   여기서는 **정규식과 문자열 치환만** 쓴다.
 *
 *   왜 그렇게 했나?
 *     - Prettier를 브라우저에 넣으면 번들이 수 MB 늘어난다
 *     - 이 도구의 목적은 "대충 읽을 수 있게" 만드는 것이지 완벽한 재출력이 아니다
 *
 *   그래서 이런 경우에는 결과가 어긋날 수 있다.
 *     - 문자열 안에 `{`, `}`, `;` 가 들어 있을 때
 *     - 주석 안에 코드처럼 생긴 글자가 있을 때
 *   실제 소스 파일을 정리하는 용도로 쓰지 말고, 조각을 확인하는 용도로 쓰자.
 */

export type FormatterLanguage = "JSON" | "HTML" | "CSS" | "JAVASCRIPT" | "TYPESCRIPT" | "MARKDOWN" | "SQL";

export interface FormatterOptions {
  tabSize: 2 | 4;
  quoteStyle: "DOUBLE" | "SINGLE";
  semicolons: boolean;
  sqlUppercase: boolean;
}

/**
 * ★ 중괄호 기준으로 들여쓰기를 만든다. CSS·JS·TS가 공유하는 핵심 로직이다.
 *
 * [처리 순서]
 *   1) 줄바꿈과 연속 공백을 전부 공백 하나로 → 원본 서식을 완전히 지운다
 *   2) `{`, `}`, `;` 뒤에 줄바꿈을 넣는다 → 한 줄에 하나씩 놓이게 만든다
 *   3) 줄마다 순회하며 들여쓰기 깊이를 계산한다
 *
 * [깊이 계산이 이 함수의 요점]
 *   - 줄이 `}` 로 시작하면 **먼저 깊이를 줄이고** 나서 들여쓴다
 *     (닫는 괄호는 자기 블록보다 한 칸 왼쪽에 놓여야 하기 때문)
 *   - 줄이 `{` 로 끝나면 **들여쓴 뒤에 깊이를 늘린다**
 *     (다음 줄부터 안쪽으로 들어가야 하기 때문)
 *   이 "언제 늘리고 언제 줄이는가"의 순서가 뒤바뀌면 결과가 한 칸씩 밀린다.
 *
 * Math.max(0, ...) 는 `}` 가 더 많은 깨진 입력에서도 음수가 되지 않게 막는다.
 */
const indentBraces = (source: string, options: FormatterOptions): string => {
  let indentation = 0;
  const indent = (): string => " ".repeat(indentation * options.tabSize);
  return source.replace(/\r?\n/g, " ").replace(/\s+/g, " ").replace(/([{};])/g, "$1\n").split("\n").map((rawLine) => rawLine.trim()).filter(Boolean).map((line) => {
    if (line.startsWith("}")) indentation = Math.max(0, indentation - 1);
    const formatted = `${indent()}${line}`;
    if (line.endsWith("{")) indentation += 1;
    return formatted;
  }).join("\n");
};

/**
 * SQL을 읽기 좋게 편다.
 *
 * ★ 키워드를 두 등급으로 나눈 것이 핵심이다.
 *   - majorKeywords (SELECT, FROM, WHERE, JOIN...) → **앞에 줄바꿈**을 넣는다.
 *     쿼리의 큰 단락을 나누는 키워드라 줄이 바뀌어야 구조가 보인다.
 *   - logicalKeywords (AND, OR, AS, ON...) → 대소문자만 통일하고 줄은 안 바꾼다.
 *     이것까지 줄을 바꾸면 한 줄에 한 단어씩 놓여 오히려 읽기 나빠진다.
 *
 * `\b` 는 단어 경계다. 이게 없으면 컬럼명 "IN_DATE" 의 "IN" 이나
 * "FROM_ID" 의 "FROM" 같은 부분 문자열까지 키워드로 잡힌다.
 *
 * `LEFT JOIN` 을 `JOIN` 보다 앞에 둔 순서도 의도적이다.
 * 정규식은 먼저 맞는 것을 택하므로, JOIN이 앞에 있으면
 * "LEFT JOIN"의 JOIN만 잘려 "LEFT \nJOIN" 이 되어 버린다.
 */
const formatSql = (source: string, uppercase: boolean): string => {
  const majorKeywords = /\b(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|UNION ALL|UNION)\b/gi;
  const logicalKeywords = /\b(AND|OR|AS|ON|IN|IS|NOT|NULL|CASE|WHEN|THEN|ELSE|END)\b/gi;
  const normalizeKeyword = (keyword: string): string => uppercase ? keyword.toUpperCase() : keyword.toLowerCase();
  return source.replace(/\s+/g, " ").replace(majorKeywords, (keyword) => `\n${normalizeKeyword(keyword)}`).replace(logicalKeywords, normalizeKeyword).trim().split("\n").map((line) => line.trim()).join("\n");
};

/**
 * 언어에 맞는 정리 방식을 골라 실행한다.
 *
 * ★ JSON만 유일하게 "제대로" 처리된다.
 *   JSON.parse로 진짜 파싱한 뒤 JSON.stringify로 다시 출력하기 때문이다.
 *   그래서 문법이 틀리면 오류를 던진다 — 이건 오히려 장점이다.
 *   "어디가 잘못됐는지" 브라우저가 알려 준다.
 *   나머지 언어는 문자열 치환이라 틀린 문법도 조용히 통과한다.
 */
export const formatSource = (language: FormatterLanguage, source: string, options: FormatterOptions = { tabSize: 2, quoteStyle: "DOUBLE", semicolons: true, sqlUppercase: true }): string => {
  if (!source.trim()) return "";

  // JSON: 진짜 파싱 → 재출력. 가장 정확하다.
  if (language === "JSON") return JSON.stringify(JSON.parse(source), null, options.tabSize);

  // HTML: 태그와 태그 사이(`><`)를 끊어 한 줄에 하나씩 놓는다.
  // 들여쓰기는 하지 않는다. 중첩 깊이를 정확히 알려면 파싱이 필요하기 때문이다.
  if (language === "HTML") return source.replace(/>\s*</g, ">\n<").split("\n").map((line) => line.trim()).join("\n");

  if (language === "CSS") return indentBraces(source, options);

  if (language === "JAVASCRIPT" || language === "TYPESCRIPT") {
    let result = indentBraces(source, options);

    // 세미콜론 제거 옵션. `(?=\s*$)` 는 "줄 끝에 있는 것만" 이라는 뜻(전방탐색)이다.
    // `m` 플래그가 있어 `$` 가 문자열 끝이 아니라 각 줄의 끝을 가리킨다.
    if (!options.semicolons) result = result.replace(/;(?=\s*$)/gm, "");

    // 큰따옴표 → 작은따옴표.
    // `"([^"\\]*(?:\\.[^"\\]*)*)"` 는 이스케이프(\")를 건너뛰며 문자열을 찾는 표준 패턴이다.
    // 바꾼 뒤 안에 있던 작은따옴표는 \' 로 escape 해야 문자열이 깨지지 않는다.
    if (options.quoteStyle === "SINGLE") result = result.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, content: string) => `'${content.replace(/'/g, "\\'")}'`);
    return result;
  }

  // Markdown: 서식을 바꾸면 의미가 달라지므로 최소한만 손댄다.
  // 줄바꿈 통일, 빈 줄 3개 이상을 2개로, 줄 끝 공백 제거.
  if (language === "MARKDOWN") return source.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n").trim();

  return formatSql(source, options.sqlUppercase);
};

/**
 * 공백과 주석을 없애 크기를 줄인다.
 *
 * ★ 주의: 이 압축은 배포용으로 쓰면 안 된다.
 *   문자열 안에 `//` 나 `/* ` 가 들어 있으면 그것까지 주석으로 보고 지운다.
 *   실제 배포 압축은 Vite(esbuild)가 파싱을 거쳐 안전하게 처리한다.
 *   여기서는 "얼마나 줄어드는지 확인"하는 학습·비교 용도다.
 */
export const minifySource = (language: FormatterLanguage, source: string): string => {
  if (!source.trim()) return "";
  // JSON은 들여쓰기 인자를 빼면 그대로 압축된다.
  if (language === "JSON") return JSON.stringify(JSON.parse(source));
  if (language === "MARKDOWN") return source.replace(/\n{3,}/g, "\n\n").trim();
  // HTML: 주석 제거 + 태그 사이 공백 제거.
  // `[^]` 는 줄바꿈을 포함한 모든 글자, `*?` 는 최소 일치(첫 번째 -->에서 멈춤)다.
  if (language === "HTML") return source.replace(/<!--[^]*?-->/g, "").replace(/>\s+</g, "><").trim();
  // 그 외(JS/CSS/SQL): 블록 주석 → 한 줄 주석 → 공백 → 기호 주변 공백 순으로 제거.
  return source.replace(/\/\*[^]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1").replace(/\s+/g, " ").replace(/\s*([{};,:=+])\s*/g, "$1").trim();
};
