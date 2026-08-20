/**
 * ============================================================================
 * caseConverter.ts — 이름 표기법 변환 (camelCase, snake_case 등)
 * ============================================================================
 *
 * [왜 필요한가]
 *   같은 개념인데 계층마다 표기법이 다르다.
 *     DB 컬럼      member_id      (snake_case)
 *     Java 필드    memberId       (camelCase)
 *     클래스 이름   MemberService  (PascalCase)
 *     CSS 클래스   member-card    (kebab-case)
 *     상수         MAX_COUNT      (CONSTANT_CASE)
 *   손으로 바꾸면 오타가 나므로 한 번에 다섯 가지를 만들어 준다.
 *
 * [핵심 아이디어]
 *   표기법마다 변환 함수를 따로 만들지 않는다.
 *   "어떤 표기법이든 일단 단어 목록으로 쪼갠 뒤, 원하는 방식으로 다시 붙인다."
 *
 *     "member_id" ─분해─▶ ["member", "id"] ─조립─▶ "memberId"
 *
 *   덕분에 입력이 어떤 표기법이든 상관없이 동작한다.
 */

export interface ConvertedCases { camel: string; pascal: string; snake: string; kebab: string; constant: string; }

/**
 * ★ 어떤 표기법의 글자든 단어 목록으로 쪼갠다. 이 함수가 전부의 기반이다.
 *
 * 세 단계로 처리한다.
 *
 * 1) `replace(/([a-z0-9])([A-Z])/g, "$1 $2")`
 *    camelCase를 쪼개기 위한 처리다. 구분자가 없어 단순 split으로는 안 된다.
 *    "소문자·숫자 뒤에 대문자가 오는 지점"에 공백을 넣는다.
 *      "memberId" → "member Id"
 *    `$1 $2` 는 "찾은 첫 번째 그룹 + 공백 + 두 번째 그룹"이라는 뜻이다.
 *
 * 2) `split(/[^a-zA-Z0-9가-힣]+/)`
 *    영문·숫자·한글이 "아닌" 것을 전부 구분자로 본다.
 *    `_`, `-`, 공백, `.` 등을 일일이 나열하지 않아도 한 번에 처리된다.
 *    `가-힣` 을 넣어 한글 이름도 단어로 살아남게 했다.
 *
 * 3) `filter(Boolean)`
 *    쪼갠 결과에 생기는 빈 문자열을 걸러낸다.
 *    "__member__" 처럼 구분자가 연달아 있으면 빈 칸이 생기기 때문이다.
 *    Boolean("")은 false, Boolean("member")는 true라는 성질을 이용한 관용구다.
 */
const splitWords = (value: string): string[] => value.trim()
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .split(/[^a-zA-Z0-9가-힣]+/)
  .filter(Boolean);

/**
 * 첫 글자만 대문자로, 나머지는 소문자로.
 *
 * ★ `.slice(1).toLowerCase()` 로 뒷부분을 소문자로 낮추는 게 중요하다.
 *   이게 없으면 "MEMBER" 를 넣었을 때 "MEMBER" 그대로 남아
 *   PascalCase 결과가 "MEMBERID" 가 되어 버린다.
 *   입력이 어떤 표기법이든 같은 결과가 나오게 하려면 반드시 낮춰야 한다.
 */
const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/**
 * 다섯 가지 표기법을 한 번에 만든다.
 *
 * 쪼갠 단어 목록 하나로 다섯 결과를 조립하므로 분해는 한 번만 한다.
 */
export const convertCase = (value: string): ConvertedCases => {
  const parts = splitWords(value);
  return {
    // camelCase: 첫 단어만 소문자, 나머지는 첫 글자 대문자
    camel: parts.map((part, index) => index === 0 ? part.toLowerCase() : capitalize(part)).join(""),
    // PascalCase: 모든 단어의 첫 글자 대문자
    pascal: parts.map(capitalize).join(""),
    // snake_case: 전부 소문자, 밑줄로 연결
    snake: parts.map((part) => part.toLowerCase()).join("_"),
    // kebab-case: 전부 소문자, 하이픈으로 연결
    kebab: parts.map((part) => part.toLowerCase()).join("-"),
    // CONSTANT_CASE: 전부 대문자, 밑줄로 연결
    constant: parts.map((part) => part.toUpperCase()).join("_"),
  };
};
