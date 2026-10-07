// jsonPathExplorer.ts — JSONPath(JSON 안의 값을 가리키는 주소)를 해석하고 실행하는 도구
//   $.store.book[0].title   → 첫 번째 책 제목       $..price           → 깊이와 관계없이 모든 price
//   $.store.book[?(@.price < 10)] → 가격 10 미만인 책  $.items[0:5]      → 0~4번째(슬라이스)
// 식을 먼저 토큰(조각) 목록으로 나눈 뒤(parseJsonPath), 루트에서 시작해 토큰마다 후보 값들을 좁혀 간다(evaluateJsonPath).

export interface JsonPathMatch {
  path: string;
  value: unknown;
}

// 토큰 종류: 자식(.이름) · 번호([0]) · 전체(*) · 재귀(..) · 슬라이스([시작:끝:간격]) · 여러 개([0,2] 또는 ['a','b']) · 필터([?(@.키 연산자 값)])
type JsonPathToken =
  | { type: "CHILD"; key: string }
  | { type: "INDEX"; index: number }
  | { type: "WILDCARD" }
  | { type: "RECURSIVE"; key?: string }
  | { type: "SLICE"; start?: number; end?: number; step: number }
  | { type: "UNION"; selectors: Array<string | number> }
  | { type: "FILTER"; key: string; operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "=~"; expected: unknown };

type JsonPathFilterOperator = Extract<JsonPathToken, { type: "FILTER" }>["operator"];

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const identifierPattern = /^[A-Za-z_$][\w$]*$/;
// 결과 경로 표시: 식별자 모양 키는 .key, 공백·특수문자가 있으면 ["key"]로 쓴다.
const appendChildPath = (path: string, key: string): string => identifierPattern.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;

const parseLiteral = (source: string): unknown => {
  const trimmed = source.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed.slice(1, -1).replace(/\\(['"\\])/g, "$1");
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (/^\/.+\/[gimsuy]*$/.test(trimmed)) return trimmed;
  throw new Error(`필터 비교값을 해석할 수 없습니다: ${trimmed}`);
};

const findBracketEnd = (expression: string, start: number): number => {
  let quote = "";
  let parenthesisDepth = 0;
  for (let index = start + 1; index < expression.length; index += 1) {
    const character = expression[index] ?? "";
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "(") parenthesisDepth += 1;
    if (character === ")") parenthesisDepth -= 1;
    if (character === "]" && parenthesisDepth === 0) return index;
  }
  return -1;
};

const splitUnion = (content: string): string[] => {
  const parts: string[] = [];
  let quote = "";
  let start = 0;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index] ?? "";
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
    } else if (character === "'" || character === '"') quote = character;
    else if (character === ",") { parts.push(content.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(content.slice(start).trim());
  return parts;
};

// 식 글자를 앞에서부터 한 글자씩 읽어 토큰으로 나눈다. 반드시 $(루트)로 시작해야 한다.
export const parseJsonPath = (expression: string): JsonPathToken[] => {
  const source = expression.trim();
  if (!source.startsWith("$")) throw new Error("JSONPath는 루트를 뜻하는 $로 시작해야 합니다.");
  const tokens: JsonPathToken[] = [];
  let index = 1;
  while (index < source.length) {
    if (/\s/.test(source[index] ?? "")) { index += 1; continue; }
    if (source.startsWith("..", index)) {
      index += 2;
      if (source[index] === "*") { tokens.push({ type: "RECURSIVE" }); index += 1; continue; }
      const match = source.slice(index).match(/^[A-Za-z_$][\w$-]*/);
      if (!match) throw new Error(`${index + 1}번째 위치의 재귀 속성 이름을 확인해 주세요.`);
      tokens.push({ type: "RECURSIVE", key: match[0] }); index += match[0].length; continue;
    }
    if (source[index] === ".") {
      index += 1;
      if (source[index] === "*") { tokens.push({ type: "WILDCARD" }); index += 1; continue; }
      const match = source.slice(index).match(/^[A-Za-z_$][\w$-]*/);
      if (!match) throw new Error(`${index + 1}번째 위치의 속성 이름을 확인해 주세요.`);
      tokens.push({ type: "CHILD", key: match[0] }); index += match[0].length; continue;
    }
    if (source[index] === "[") {
      const end = findBracketEnd(source, index);
      if (end < 0) throw new Error("닫는 대괄호 ]가 필요합니다.");
      const content = source.slice(index + 1, end).trim();
      if (content === "*") tokens.push({ type: "WILDCARD" });
      else if (/^-?\d+$/.test(content)) tokens.push({ type: "INDEX", index: Number(content) });
      else if (/^(['"]).*\1$/.test(content)) tokens.push({ type: "CHILD", key: String(parseLiteral(content)) });
      else if (/^-?\d*:-?\d*(?::-?\d+)?$/.test(content)) {
        const [startText, endText, stepText] = content.split(":");
        const step = stepText ? Number(stepText) : 1;
        if (step === 0) throw new Error("배열 Slice의 step은 0일 수 없습니다.");
        tokens.push({ type: "SLICE", start: startText ? Number(startText) : undefined, end: endText ? Number(endText) : undefined, step });
      } else if (content.startsWith("?(")) {
        const filterMatch = content.match(/^\?\(\s*@(?:\.([A-Za-z_$][\w$-]*))?\s*(==|!=|>=|<=|>|<|=~)\s*(.+)\s*\)$/);
        if (!filterMatch?.[1] || !filterMatch[2] || filterMatch[3] === undefined) throw new Error("필터는 [?(@.속성 >= 값)] 형식으로 입력해 주세요.");
        tokens.push({
          type: "FILTER",
          key: filterMatch[1],
          operator: filterMatch[2] as JsonPathFilterOperator,
          expected: parseLiteral(filterMatch[3]),
        });
      } else if (content.includes(",")) {
        const selectors = splitUnion(content).map((selector) => /^-?\d+$/.test(selector) ? Number(selector) : parseLiteral(selector));
        if (!selectors.every((selector) => typeof selector === "number" || typeof selector === "string")) throw new Error("Union에는 속성명 또는 배열 인덱스만 사용할 수 있습니다.");
        tokens.push({ type: "UNION", selectors });
      } else throw new Error(`지원하지 않는 대괄호 표현입니다: [${content}]`);
      index = end + 1; continue;
    }
    throw new Error(`${index + 1}번째 위치의 '${source[index]}' 문법을 확인해 주세요.`);
  }
  return tokens;
};

// 필터 비교. =~는 /패턴/플래그 모양의 정규식과 비교한다(g 플래그는 test 결과를 흔들어 제거).
const compareFilter = (actual: unknown, operator: JsonPathFilterOperator, expected: unknown): boolean => {
  if (operator === "==") return actual === expected;
  if (operator === "!=") return actual !== expected;
  if (operator === "=~") {
    if (typeof actual !== "string" || typeof expected !== "string") return false;
    const match = expected.match(/^\/(.*)\/([gimsuy]*)$/);
    if (!match?.[1]) return false;
    return new RegExp(match[1], match[2]?.replace("g", "")).test(actual);
  }
  if ((typeof actual !== "number" && typeof actual !== "string") || (typeof expected !== "number" && typeof expected !== "string")) return false;
  if (operator === ">") return actual > expected;
  if (operator === ">=") return actual >= expected;
  if (operator === "<") return actual < expected;
  return actual <= expected;
};

// 실행: 현재 후보 목록(nodes)에 토큰을 하나씩 적용해 다음 후보 목록을 만든다. 결과가 너무 많아지지 않게 최대 5,000개로 자른다.
export const evaluateJsonPath = (root: unknown, expression: string, maximumMatches = 5000): JsonPathMatch[] => {
  const tokens = parseJsonPath(expression);
  let nodes: JsonPathMatch[] = [{ path: "$", value: root }];
  const push = (target: JsonPathMatch[], match: JsonPathMatch): void => { if (target.length < maximumMatches) target.push(match); };
  tokens.forEach((token) => {
    const nextNodes: JsonPathMatch[] = [];
    nodes.forEach((node) => {
      if (token.type === "CHILD" && isRecord(node.value) && token.key in node.value) push(nextNodes, { path: appendChildPath(node.path, token.key), value: node.value[token.key] });
      if (token.type === "INDEX" && Array.isArray(node.value)) {
        const resolvedIndex = token.index < 0 ? node.value.length + token.index : token.index;
        if (resolvedIndex >= 0 && resolvedIndex < node.value.length) push(nextNodes, { path: `${node.path}[${resolvedIndex}]`, value: node.value[resolvedIndex] });
      }
      if (token.type === "WILDCARD") {
        if (Array.isArray(node.value)) node.value.forEach((value, arrayIndex) => push(nextNodes, { path: `${node.path}[${arrayIndex}]`, value }));
        else if (isRecord(node.value)) Object.entries(node.value).forEach(([key, value]) => push(nextNodes, { path: appendChildPath(node.path, key), value }));
      }
      if (token.type === "SLICE" && Array.isArray(node.value)) {
        const length = node.value.length;
        const normalize = (value: number | undefined, fallback: number): number => value === undefined ? fallback : value < 0 ? Math.max(0, length + value) : Math.min(length, value);
        const start = normalize(token.start, token.step > 0 ? 0 : length - 1);
        const end = normalize(token.end, token.step > 0 ? length : -1);
        if (token.step > 0) for (let arrayIndex = start; arrayIndex < end; arrayIndex += token.step) push(nextNodes, { path: `${node.path}[${arrayIndex}]`, value: node.value[arrayIndex] });
        else for (let arrayIndex = start; arrayIndex > end; arrayIndex += token.step) push(nextNodes, { path: `${node.path}[${arrayIndex}]`, value: node.value[arrayIndex] });
      }
      if (token.type === "UNION") token.selectors.forEach((selector) => {
        if (typeof selector === "number" && Array.isArray(node.value)) {
          const arrayIndex = selector < 0 ? node.value.length + selector : selector;
          if (arrayIndex >= 0 && arrayIndex < node.value.length) push(nextNodes, { path: `${node.path}[${arrayIndex}]`, value: node.value[arrayIndex] });
        } else if (typeof selector === "string" && isRecord(node.value) && selector in node.value) push(nextNodes, { path: appendChildPath(node.path, selector), value: node.value[selector] });
      });
      if (token.type === "FILTER" && Array.isArray(node.value)) node.value.forEach((value, arrayIndex) => {
        if (isRecord(value) && compareFilter(value[token.key], token.operator, token.expected)) push(nextNodes, { path: `${node.path}[${arrayIndex}]`, value });
      });
      if (token.type === "RECURSIVE") {
        const visit = (value: unknown, path: string): void => {
          if (Array.isArray(value)) value.forEach((child, arrayIndex) => {
            const childPath = `${path}[${arrayIndex}]`;
            if (!token.key) push(nextNodes, { path: childPath, value: child });
            visit(child, childPath);
          });
          else if (isRecord(value)) Object.entries(value).forEach(([key, child]) => {
            const childPath = appendChildPath(path, key);
            if (!token.key || token.key === key) push(nextNodes, { path: childPath, value: child });
            visit(child, childPath);
          });
        };
        visit(node.value, node.path);
      }
    });
    nodes = nextNodes;
  });
  return nodes;
};

export const jsonPathForChild = (parentPath: string, key: string | number): string => typeof key === "number" ? `${parentPath}[${key}]` : appendChildPath(parentPath, key);
