import DOMPurify from "dompurify";

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

const renderInline = (value: string): string => escapeHtml(value)
  // 겹치는 기호는 긴 문법부터 바꿔야 ***가 **와 *로 잘못 나뉘지 않습니다.
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
  .replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/__([^_]+)__/g, "<strong>$1</strong>")
  .replace(/~~([^~]+)~~/g, "<del>$1</del>")
  .replace(/\*([^*]+)\*/g, "<em>$1</em>")
  .replace(/_([^_]+)_/g, "<em>$1</em>")
  .replace(/!\[([^\]]*)]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
  .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  // Markdown에는 밑줄 표준 문법이 없어 정확한 <u> 태그만 제한적으로 되살립니다.
  .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>");

type SyntaxTokenType = "comment" | "keyword" | "number" | "string" | "tag";

const tokenPatterns: Record<string, RegExp> = {
  javascript: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:as|async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b|\b\d+(?:\.\d+)?\b)/g,
  typescript: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:abstract|any|as|async|await|boolean|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|instanceof|interface|keyof|let|never|new|null|number|of|private|protected|public|readonly|return|static|string|super|switch|this|throw|true|try|type|typeof|undefined|unknown|var|void|while|yield)\b|\b\d+(?:\.\d+)?\b)/g,
  java: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:abstract|boolean|break|byte|case|catch|char|class|continue|default|do|double|else|enum|extends|false|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|true|try|void|volatile|while)\b|\b\d+(?:\.\d+)?\b)/g,
  json: /("(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/gi,
  python: /(#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b|\b\d+(?:\.\d+)?\b)/g,
  sql: /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\b(?:add|alter|and|as|asc|by|case|create|delete|desc|distinct|drop|else|end|exists|false|from|full|group|having|in|inner|insert|into|is|join|left|like|limit|not|null|on|or|order|outer|primary|references|right|select|set|table|then|true|union|unique|update|values|when|where)\b|\b\d+(?:\.\d+)?\b)/gi,
  bash: /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:case|do|done|elif|else|esac|export|fi|for|function|if|in|local|readonly|return|then|until|while)\b|\b\d+(?:\.\d+)?\b)/g,
};

const tokenType = (token: string, language: string): SyntaxTokenType => {
  if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#") || token.startsWith("--")) return "comment";
  if (/^["'`]/.test(token)) return "string";
  if (/^-?\d/.test(token)) return "number";
  if (language === "html") return "tag";
  return "keyword";
};

const highlightCode = (source: string, requestedLanguage: string): string => {
  const language = requestedLanguage.toLocaleLowerCase();
  if (language === "html") {
    return source.split(/(<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>)/g).map((token) => {
      if (token.startsWith("<!--")) return `<span class="syntax-comment">${escapeHtml(token)}</span>`;
      if (token.startsWith("<")) return `<span class="syntax-tag">${escapeHtml(token)}</span>`;
      return escapeHtml(token);
    }).join("");
  }
  if (language === "css") {
    const pattern = /(\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[a-fA-F\d]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|s|ms|vh|vw)?\b)/g;
    const highlighted: string[] = [];
    let previousEnd = 0;
    let match = pattern.exec(source);
    while (match) {
      highlighted.push(escapeHtml(source.slice(previousEnd, match.index)));
      const type: SyntaxTokenType = match[0].startsWith("/*") ? "comment" : /^["']/.test(match[0]) ? "string" : "number";
      highlighted.push(`<span class="syntax-${type}">${escapeHtml(match[0])}</span>`);
      previousEnd = match.index + match[0].length;
      match = pattern.exec(source);
    }
    highlighted.push(escapeHtml(source.slice(previousEnd)));
    return highlighted.join("");
  }
  const pattern = tokenPatterns[language];
  if (!pattern) return escapeHtml(source);
  pattern.lastIndex = 0;
  const highlighted: string[] = [];
  let previousEnd = 0;
  let match = pattern.exec(source);
  while (match) {
    highlighted.push(escapeHtml(source.slice(previousEnd, match.index)));
    highlighted.push(`<span class="syntax-${tokenType(match[0], language)}">${escapeHtml(match[0])}</span>`);
    previousEnd = match.index + match[0].length;
    match = pattern.exec(source);
  }
  highlighted.push(escapeHtml(source.slice(previousEnd)));
  return highlighted.join("");
};

type TableAlignment = "left" | "center" | "right";

const parseTableCells = (line: string): string[] => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

const parseTableAlignments = (line: string): TableAlignment[] | undefined => {
  const cells = parseTableCells(line);
  if (cells.length === 0 || cells.some((cell) => !/^:?-{3,}:?$/.test(cell))) return undefined;
  return cells.map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
};

export const renderMarkdown = (source: string): string => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | "task" | null = null;

  const closeList = (): void => {
    if (listType) html.push(listType === "task" ? "</ul>" : `</${listType}>`);
    listType = null;
  };

  const openList = (nextListType: "ul" | "ol" | "task"): void => {
    if (listType === nextListType) return;
    closeList();
    listType = nextListType;
    html.push(nextListType === "task" ? '<ul class="markdown-task-list">' : `<${nextListType}>`);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (line.startsWith("```")) {
      closeList();
      const language = line.slice(3).trim().replace(/[^a-zA-Z0-9_-]/g, "").toLocaleLowerCase();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      const languageLabel = language || "text";
      html.push(`<pre class="syntax-code-block" data-language="${escapeHtml(languageLabel)}"><code class="language-${escapeHtml(languageLabel)}">${highlightCode(codeLines.join("\n"), language)}</code></pre>`);
      continue;
    }

    const tableAlignments = index + 1 < lines.length ? parseTableAlignments(lines[index + 1] ?? "") : undefined;
    if (line.includes("|") && tableAlignments) {
      closeList();
      const headers = parseTableCells(line);
      if (headers.length === tableAlignments.length) {
        const bodyRows: string[][] = [];
        index += 2;
        while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim()) {
          bodyRows.push(parseTableCells(lines[index] ?? ""));
          index += 1;
        }
        index -= 1;
        const renderCell = (cell: string, cellIndex: number, tag: "th" | "td"): string => `<${tag} class="align-${tableAlignments[cellIndex] ?? "left"}">${renderInline(cell)}</${tag}>`;
        html.push(`<table><thead><tr>${headers.map((header, cellIndex) => renderCell(header, cellIndex, "th")).join("")}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${headers.map((_, cellIndex) => renderCell(row[cellIndex] ?? "", cellIndex, "td")).join("")}</tr>`).join("")}</tbody></table>`);
        continue;
      }
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1]?.length ?? 1;
      html.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
      continue;
    }

    const task = line.match(/^\s*[-*+]\s+\[([ xX])]\s+(.+)$/);
    if (task) {
      openList("task");
      const checked = task[1]?.toLocaleLowerCase() === "x";
      html.push(`<li><input type="checkbox" disabled${checked ? " checked" : ""} aria-label="${checked ? "완료" : "미완료"}"><span>${renderInline(task[2] ?? "")}</span></li>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextListType = unordered ? "ul" : "ol";
      openList(nextListType);
      html.push(`<li>${renderInline((unordered ?? ordered)?.[1] ?? "")}</li>`);
      continue;
    }

    closeList();
    const horizontalRule = line.trim().replace(/\s/g, "");
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(horizontalRule)) html.push("<hr>");
    else if (/^>\s?/.test(line)) html.push(`<blockquote>${renderInline(line.replace(/^>\s?/, ""))}</blockquote>`);
    else if (!line.trim()) html.push("");
    else html.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  return DOMPurify.sanitize(html.join("\n"), { USE_PROFILES: { html: true } });
};

export const createMarkdownHtmlDocument = (title: string, renderedHtml: string): string => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>body{max-width:860px;margin:40px auto;padding:0 20px;font:16px/1.7 system-ui;color:#172033}pre{padding:16px;overflow:auto;background:#f4f6fa;border-radius:10px}code{font-family:ui-monospace,monospace}blockquote{border-left:4px solid #7188ff;margin-left:0;padding-left:16px;color:#536079}img{max-width:100%}table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border:1px solid #d8deea}.align-left{text-align:left}.align-center{text-align:center}.align-right{text-align:right}.markdown-task-list{padding:0;list-style:none}.markdown-task-list li{display:flex;gap:8px}</style></head><body>${renderedHtml}</body></html>`;
