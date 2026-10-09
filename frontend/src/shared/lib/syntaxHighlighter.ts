/**
 * syntaxHighlighter.ts — 코드를 "색칠할 조각" 배열로 나눈다(주석·키워드·문자열·숫자·태그·속성·제목)
 *
 *   highlightSegments('const a = "x";', "javascript")
 *   → [{ text: "const", type: "keyword" }, { text: " a = " }, { text: '"x"', type: "string" }, { text: ";" }]
 *
 * 조각을 이어 붙이면 원문과 글자 하나까지 똑같다(색만 입힘). 화면은 조각마다 <span class="syntax-종류">를 쓰고,
 * 실제 색은 CSS 변수(--syntax-keyword 등)가 라이트·다크 테마별로 정한다.
 *
 * 쓰는 곳: Markdown 미리보기의 코드 블록(markdownRenderer.ts), Code Formatter·SQL Formatter의 입력·결과(HighlightedTextarea).
 * ★ 정규식으로 찾는 경량 색칠이라 문법 트리를 만드는 진짜 하이라이터(Prism 등)보다 단순하다. 새 의존성 없이 쓰려는 선택이다.
 */
export type SyntaxTokenType = "comment" | "keyword" | "number" | "string" | "tag" | "property" | "heading";

export interface SyntaxSegment {
  text: string;
  type?: SyntaxTokenType; // 없으면 기본 글자색
}

// 언어별 주석·문자열·키워드·숫자 패턴(앞에 있는 것부터 맞춘다: 주석 → 문자열 → 키워드 → 숫자)
const tokenPatterns: Record<string, RegExp> = {
  javascript: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:as|async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b|\b\d+(?:\.\d+)?\b)/g,
  typescript: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:abstract|any|as|async|await|boolean|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|instanceof|interface|keyof|let|never|new|null|number|of|private|protected|public|readonly|return|static|string|super|switch|this|throw|true|try|type|typeof|undefined|unknown|var|void|while|yield)\b|\b\d+(?:\.\d+)?\b)/g,
  java: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:abstract|boolean|break|byte|case|catch|char|class|continue|default|do|double|else|enum|extends|false|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|true|try|void|volatile|while)\b|\b\d+(?:\.\d+)?\b)/g,
  json: /("(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/gi,
  python: /(#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b|\b\d+(?:\.\d+)?\b)/g,
  sql: /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[#$]\{[^}\n]*\}|\b(?:add|all|alter|and|as|asc|between|by|case|create|cross|delete|desc|distinct|drop|else|end|exists|false|from|full|group|having|in|inner|insert|into|is|join|left|like|limit|not|null|offset|on|or|order|outer|primary|references|right|select|set|table|then|true|union|unique|update|using|values|when|where|with)\b|\b\d+(?:\.\d+)?\b)/gi,
  bash: /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:case|do|done|elif|else|esac|export|fi|for|function|if|in|local|readonly|return|then|until|while)\b|\b\d+(?:\.\d+)?\b)/g,
  // Markdown: 제목 줄, 인라인 코드, 굵게, 목록 기호, 링크
  markdown: /(^#{1,6}\s[^\n]*|`[^`\n]+`|\*\*[^*\n]+\*\*|^[ \t]*(?:[-*+]|\d+\.)(?=\s)|\[[^\]\n]*\]\([^)\n]*\))/gm,
};

/** 찾은 글자 조각의 종류를 정한다. */
const tokenType = (token: string, language: string, followingText: string): SyntaxTokenType => {
  if (language === "markdown") {
    if (token.startsWith("#")) return "heading";
    if (token.startsWith("`")) return "string";
    if (token.startsWith("**")) return "keyword";
    if (token.startsWith("[")) return "property";
    return "tag"; // 목록 기호
  }
  if (token.startsWith("//") || token.startsWith("/*") || (token.startsWith("#") && language !== "sql") || token.startsWith("--")) return "comment";
  if (token.startsWith("#{") || token.startsWith("${")) return "property"; // MyBatis 파라미터
  // JSON: 뒤에 ":"가 오는 문자열은 키(속성 이름)
  if (/^["'`]/.test(token)) return language === "json" && /^\s*:/.test(followingText) ? "property" : "string";
  if (/^-?\d/.test(token)) return "number";
  return "keyword";
};

/** 패턴에 맞는 부분만 색칠 조각으로 만들고, 그 사이 글자는 색 없는 조각으로 둔다. */
const segmentByPattern = (source: string, pattern: RegExp, typeOf: (token: string, followingText: string) => SyntaxTokenType): SyntaxSegment[] => {
  const segments: SyntaxSegment[] = [];
  let previousEnd = 0;
  pattern.lastIndex = 0;
  let match = pattern.exec(source);
  while (match) {
    if (match[0].length === 0) { // 빈 일치로 무한 반복하지 않게 한 칸 넘긴다
      pattern.lastIndex += 1;
      match = pattern.exec(source);
      continue;
    }
    if (match.index > previousEnd) segments.push({ text: source.slice(previousEnd, match.index) });
    const end = match.index + match[0].length;
    segments.push({ text: match[0], type: typeOf(match[0], source.slice(end, end + 20)) });
    previousEnd = end;
    match = pattern.exec(source);
  }
  if (previousEnd < source.length) segments.push({ text: source.slice(previousEnd) });
  return segments;
};

/** HTML: 주석, 태그 이름(<div, </div, >), 속성 이름(class=), 속성 값("...")을 나눠 칠한다. */
const highlightHtml = (source: string): SyntaxSegment[] =>
  source.split(/(<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>)/g).filter(Boolean).flatMap((part): SyntaxSegment[] => {
    if (part.startsWith("<!--")) return [{ text: part, type: "comment" }];
    if (!part.startsWith("<")) return [{ text: part }];
    return segmentByPattern(part, /(<\/?[\w-]+|\/?>|[\w:-]+(?==)|"[^"]*"|'[^']*')/g, (token) => {
      if (token.startsWith("<") || token.endsWith(">")) return "tag";
      if (/^["']/.test(token)) return "string";
      return "property";
    });
  });

/** CSS: 주석·문자열·색상·숫자 + 중괄호 안의 속성 이름(color:), @규칙(@media) */
const highlightCss = (source: string): SyntaxSegment[] => {
  let braceDepth = 0;
  return segmentByPattern(source, /(\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@[\w-]+|[{}]|#[a-fA-F\d]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|rem|em|%|s|ms|vh|vw|deg|fr)?\b|[\w-]+(?=\s*:))/g, (token) => {
    if (token === "{") braceDepth += 1;
    if (token === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (token === "{" || token === "}") return "tag";
    if (token.startsWith("/*")) return "comment";
    if (/^["']/.test(token)) return "string";
    if (token.startsWith("@")) return "keyword";
    if (/^(?:#|-?\d)/.test(token)) return "number";
    return braceDepth > 0 ? "property" : "tag"; // 중괄호 밖 "a:hover"의 a는 선택자
  });
};

/** YAML: 주석, 키(뒤에 :), 따옴표 문자열, 목록 기호(-), true/false/null, 숫자 */
const highlightYaml = (source: string): SyntaxSegment[] =>
  segmentByPattern(source, /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|^[ \t]*-(?=\s)|[\w.-]+(?=[ \t]*:(?:\s|$))|\b(?:true|false|null|yes|no|on|off)\b|-?\b\d+(?:\.\d+)?\b)/gim, (token, followingText) => {
    if (token.startsWith("#")) return "comment";
    if (/^["']/.test(token)) return "string";
    if (token.trim() === "-") return "tag";
    if (/^-?\d/.test(token)) return "number";
    if (/^[ \t]*:/.test(followingText)) return "property";
    return "keyword";
  });

/** 형식을 모르는 글(API 응답 Body 등)의 언어를 첫 글자로 짐작한다: { [ → JSON, < → HTML/XML, 그 밖은 색 없음 */
export const guessCodeLanguage = (text: string): string => {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<")) return "html";
  return "text";
};

/** 같은 언어의 다른 이름(ts → typescript 등). 화면마다 쓰는 이름이 달라도 같은 색칠을 쓰게 한다. */
const languageAliases: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", yml: "yaml", xml: "html",
  shell: "bash", sh: "bash", curl: "bash", gradle: "java", kotlin: "java", groovy: "java", mysql: "sql",
};

/** 언어 이름(대소문자 무관)에 맞춰 색칠 조각을 만든다. 모르는 언어는 색 없이 한 조각으로 돌려준다. */
export const highlightSegments = (source: string, requestedLanguage: string): SyntaxSegment[] => {
  if (!source) return [];
  const lowerLanguage = requestedLanguage.toLowerCase();
  const language = languageAliases[lowerLanguage] ?? lowerLanguage;
  if (language === "html") return highlightHtml(source);
  if (language === "css") return highlightCss(source);
  if (language === "yaml") return highlightYaml(source);
  const pattern = tokenPatterns[language];
  if (!pattern) return [{ text: source }];
  return segmentByPattern(source, pattern, (token, followingText) => tokenType(token, language, followingText));
};
