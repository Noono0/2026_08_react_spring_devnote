// markdownEditorCommands.ts — 마크다운 편집기의 도구 모음 버튼 동작(굵게, 제목, 목록, 코드 블록 …)
// textarea의 글과 선택 범위(시작·끝 위치)를 받아 "바뀐 글 + 새 선택 범위"를 돌려주는 순수 함수다.
// 화면은 그 결과로 State를 바꾸고 커서를 옮긴다(직접 DOM 글자를 고치지 않는다).

export type MarkdownCodeLanguage = "JAVASCRIPT" | "TYPESCRIPT" | "PYTHON" | "JAVA" | "SQL" | "JSON" | "HTML" | "CSS" | "BASH";

export type MarkdownEditorCommand =
  | "BOLD"
  | "ITALIC"
  | "BOLD_ITALIC"
  | "STRIKETHROUGH"
  | "UNDERLINE"
  | "INLINE_CODE"
  | "UNORDERED_LIST"
  | "ORDERED_LIST"
  | "TASK_LIST"
  | "BLOCKQUOTE"
  | "CODE_BLOCK"
  | `CODE_BLOCK_${MarkdownCodeLanguage}`
  | "LINK"
  | "IMAGE"
  | "TABLE"
  | "HORIZONTAL_RULE"
  | `HEADING_${1 | 2 | 3 | 4 | 5 | 6}`;

export interface MarkdownCommandResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

type InlineMarkdownCommand = "BOLD" | "ITALIC" | "BOLD_ITALIC" | "STRIKETHROUGH" | "UNDERLINE" | "INLINE_CODE";

// 글자 서식별 [앞 기호, 뒤 기호, 선택이 없을 때 넣을 예시 글]. 예) 굵게 = **글**
const inlineWrappers: Record<InlineMarkdownCommand, [string, string, string]> = {
  BOLD: ["**", "**", "굵은 글씨"],
  ITALIC: ["*", "*", "기울임꼴"],
  BOLD_ITALIC: ["***", "***", "굵은 기울임꼴"],
  STRIKETHROUGH: ["~~", "~~", "취소선"],
  UNDERLINE: ["<u>", "</u>", "밑줄"],
  INLINE_CODE: ["`", "`", "코드"],
};

const isInlineCommand = (command: MarkdownEditorCommand): command is InlineMarkdownCommand => command in inlineWrappers;

// 선택한 글을 기호로 감싼다. 선택한 글 바로 앞뒤에 이미 같은 기호가 있으면 벗겨 "켜고 끄기"처럼 동작한다. 선택이 없으면 예시 글을 넣는다.
const wrapSelection = (
  source: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
  placeholder: string,
): MarkdownCommandResult => {
  const selectedText = source.slice(selectionStart, selectionEnd);
  const valueToWrap = selectedText || placeholder;
  const alreadyWrapped = selectionStart >= prefix.length
    && source.slice(selectionStart - prefix.length, selectionStart) === prefix
    && source.slice(selectionEnd, selectionEnd + suffix.length) === suffix;

  if (selectedText && alreadyWrapped) {
    return {
      value: `${source.slice(0, selectionStart - prefix.length)}${selectedText}${source.slice(selectionEnd + suffix.length)}`,
      selectionStart: selectionStart - prefix.length,
      selectionEnd: selectionEnd - prefix.length,
    };
  }

  return {
    value: `${source.slice(0, selectionStart)}${prefix}${valueToWrap}${suffix}${source.slice(selectionEnd)}`,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionStart + prefix.length + valueToWrap.length,
  };
};

// 선택한 줄들의 맨 앞을 바꾼다(제목 #, 목록 -, 번호 1., 인용 > 등). 여러 줄을 골라도 줄마다 적용된다.
const transformSelectedLines = (
  source: string,
  selectionStart: number,
  selectionEnd: number,
  transformLine: (line: string, index: number) => string,
): MarkdownCommandResult => {
  const lineStart = source.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const nextLineBreak = source.indexOf("\n", selectionEnd);
  const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
  const selectedLines = source.slice(lineStart, lineEnd).split("\n");
  const transformed = selectedLines.map(transformLine).join("\n");
  return {
    value: `${source.slice(0, lineStart)}${transformed}${source.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + transformed.length,
  };
};

// 줄 앞에 이미 붙어 있는 블록 기호(#, -, 1., >, - [ ])를 먼저 지워 기호가 겹쳐 쌓이지 않게 한다.
const stripBlockPrefix = (line: string): string => line
  .replace(/^\s{0,3}#{1,6}\s+/, "")
  .replace(/^\s*(?:[-*+]\s+\[[ xX]]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, "");

// 표·코드 블록·구분선 같은 덩어리를 커서 위치에 넣는다. 앞뒤 글과 같은 줄에 붙지 않도록 필요하면 줄바꿈을 넣고, 넣은 덩어리를 선택 상태로 만든다.
const insertBlock = (source: string, selectionStart: number, selectionEnd: number, block: string): MarkdownCommandResult => {
  const before = source.slice(0, selectionStart);
  const after = source.slice(selectionEnd);
  const leadingBreak = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const trailingBreak = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
  const inserted = `${leadingBreak}${block}${trailingBreak}`;
  return {
    value: `${before}${inserted}${after}`,
    selectionStart: selectionStart + leadingBreak.length,
    selectionEnd: selectionStart + leadingBreak.length + block.length,
  };
};

// 버튼 종류에 따라 위 도우미 중 하나를 골라 실행하는 입구.
export const applyMarkdownCommand = (
  source: string,
  selectionStart: number,
  selectionEnd: number,
  command: MarkdownEditorCommand,
): MarkdownCommandResult => {
  const safeStart = Math.max(0, Math.min(selectionStart, source.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, source.length));

  if (command.startsWith("HEADING_")) {
    const level = Number(command.slice(-1));
    return transformSelectedLines(source, safeStart, safeEnd, (line) => `${"#".repeat(level)} ${stripBlockPrefix(line)}`);
  }
  if (command === "UNORDERED_LIST") return transformSelectedLines(source, safeStart, safeEnd, (line) => `- ${stripBlockPrefix(line)}`);
  if (command === "ORDERED_LIST") return transformSelectedLines(source, safeStart, safeEnd, (line, index) => `${index + 1}. ${stripBlockPrefix(line)}`);
  if (command === "TASK_LIST") return transformSelectedLines(source, safeStart, safeEnd, (line) => `- [ ] ${stripBlockPrefix(line)}`);
  if (command === "BLOCKQUOTE") return transformSelectedLines(source, safeStart, safeEnd, (line) => `> ${stripBlockPrefix(line)}`);
  if (command === "CODE_BLOCK") return wrapSelection(source, safeStart, safeEnd, "```\n", "\n```", "코드를 입력하세요");
  if (command.startsWith("CODE_BLOCK_")) {
    const language = command.slice("CODE_BLOCK_".length).toLocaleLowerCase();
    return wrapSelection(source, safeStart, safeEnd, `\`\`\`${language}\n`, "\n```", "코드를 입력하세요");
  }
  if (command === "HORIZONTAL_RULE") return insertBlock(source, safeStart, safeEnd, "---");
  if (command === "LINK") return wrapSelection(source, safeStart, safeEnd, "[", "](https://example.com)", "링크 텍스트");
  if (command === "IMAGE") return wrapSelection(source, safeStart, safeEnd, "![", "](https://example.com/image.png)", "이미지 설명");
  if (command === "TABLE") return insertBlock(source, safeStart, safeEnd, "| 이름 | 나이 | 직업 |\n| :--- | :---: | ---: |\n| 민수 | 20 | 학생 |\n| 영희 | 25 | 개발자 |");

  if (!isInlineCommand(command)) throw new Error(`지원하지 않는 Markdown 명령입니다: ${command}`);
  const [prefix, suffix, placeholder] = inlineWrappers[command];
  return wrapSelection(source, safeStart, safeEnd, prefix, suffix, placeholder);
};
