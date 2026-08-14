export type RegexMode = "FIND" | "FULL" | "REPLACE";

export interface RegexMatchResult {
  match: string;
  start: number;
  end: number;
  groups: Array<{ name: string; value: string }>;
}

export interface RegexExecutionResult {
  matched: boolean;
  matches: RegexMatchResult[];
  replacedText?: string;
  truncated: boolean;
}

const maximumInputLength = 100_000;
const maximumMatches = 200;

const normalizedFlags = (flags: string, requireGlobal: boolean): string => {
  const uniqueFlags = [...new Set(flags.replace(/[^dgimsuvy]/g, ""))].join("");
  return requireGlobal && !uniqueFlags.includes("g") ? `${uniqueFlags}g` : uniqueFlags;
};

const toGroups = (match: RegExpExecArray): RegexMatchResult["groups"] => {
  const numberedGroups = match.slice(1).map((value, index) => ({ name: String(index + 1), value: value ?? "" }));
  const namedGroups = Object.entries(match.groups ?? {}).map(([name, value]) => ({ name, value: value ?? "" }));
  return [...numberedGroups, ...namedGroups];
};

export const runJavaScriptRegex = (
  pattern: string,
  flags: string,
  input: string,
  mode: RegexMode,
  replacement = "",
): RegexExecutionResult => {
  if (!pattern) throw new Error("정규식 패턴을 입력해 주세요.");
  if (input.length > maximumInputLength) throw new Error("테스트 문자열은 100,000자 이하로 입력해 주세요.");

  if (mode === "FULL") {
    const expression = new RegExp(`^(?:${pattern})$`, normalizedFlags(flags, false).replace("g", ""));
    const match = expression.exec(input);
    return { matched: Boolean(match), matches: match ? [{ match: match[0], start: 0, end: match[0].length, groups: toGroups(match) }] : [], truncated: false };
  }

  if (mode === "REPLACE") {
    const expression = new RegExp(pattern, normalizedFlags(flags, true));
    const matches = collectMatches(expression, input);
    return { ...matches, replacedText: input.replace(expression, replacement) };
  }
  return collectMatches(new RegExp(pattern, normalizedFlags(flags, true)), input);
};

const collectMatches = (expression: RegExp, input: string): RegexExecutionResult => {
  const matches: RegexMatchResult[] = [];
  let currentMatch = expression.exec(input);
  while (currentMatch && matches.length < maximumMatches) {
    matches.push({ match: currentMatch[0], start: currentMatch.index, end: currentMatch.index + currentMatch[0].length, groups: toGroups(currentMatch) });
    // 빈 문자열 매칭은 lastIndex가 진행되지 않을 수 있어 무한 반복을 직접 막습니다.
    if (currentMatch[0] === "") expression.lastIndex += 1;
    currentMatch = expression.exec(input);
  }
  return { matched: matches.length > 0, matches, truncated: Boolean(currentMatch) };
};

const explanations: Array<[RegExp, string]> = [
  [/^\^$/, "문자열의 시작"],
  [/^\$$/, "문자열의 끝"],
  [/^\\d$/, "숫자 한 글자"],
  [/^\\w$/, "영문자·숫자·밑줄 한 글자"],
  [/^\\s$/, "공백 문자 한 글자"],
  [/^\.$/, "줄바꿈을 제외한 임의의 한 글자"],
  [/^\*$/, "앞 표현을 0번 이상 반복"],
  [/^\+$/, "앞 표현을 1번 이상 반복"],
  [/^\?$/, "앞 표현이 0번 또는 1번 등장"],
  [/^\|$/, "왼쪽 또는 오른쪽 표현"],
];

export interface RegexExplanationToken { token: string; description: string }

export const explainRegex = (pattern: string): RegexExplanationToken[] => {
  const tokens = pattern.match(/\\.|\[[^\]]*]|\(\?<[^>]+>|\(\?:|\(\?=|\(\?!|\(|\)|\{\d+(?:,\d*)?}|\*\?|\+\?|\.\*|\.\+|[+*?^$|.]|[^\\[({+*?^$|.)]+/g) ?? [];
  return tokens.map((token) => {
    const fixed = explanations.find(([matcher]) => matcher.test(token))?.[1];
    if (fixed) return { token, description: fixed };
    if (token.startsWith("[")) return { token, description: "대괄호 안 문자 중 한 글자" };
    if (/^\{\d+/.test(token)) return { token, description: `앞 표현의 반복 횟수 ${token}` };
    if (token.startsWith("(?<")) return { token, description: "이름 있는 캡처 그룹 시작" };
    if (token === "(?:") return { token, description: "결과를 저장하지 않는 그룹 시작" };
    if (token === "(?=") return { token, description: "뒤에 조건이 이어지는지 확인하는 긍정 Lookahead" };
    if (token === "(?!") return { token, description: "뒤에 조건이 이어지지 않는지 확인하는 부정 Lookahead" };
    if (token === "(") return { token, description: "캡처 그룹 시작" };
    if (token === ")") return { token, description: "그룹 끝" };
    if (token.startsWith("\\")) return { token, description: `이스케이프된 표현 ${token}` };
    return { token, description: `문자 그대로 “${token}”` };
  });
};

export const hasPotentialRedosRisk = (pattern: string): boolean => /(\([^)]*[+*][^)]*\))[+*{]/.test(pattern) || /(\.\*){2,}/.test(pattern);

