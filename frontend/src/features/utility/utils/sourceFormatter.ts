export type FormatterLanguage = "JSON" | "HTML" | "CSS" | "JAVASCRIPT" | "TYPESCRIPT" | "MARKDOWN" | "SQL";

export interface FormatterOptions {
  tabSize: 2 | 4;
  quoteStyle: "DOUBLE" | "SINGLE";
  semicolons: boolean;
  sqlUppercase: boolean;
}

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

const formatSql = (source: string, uppercase: boolean): string => {
  const majorKeywords = /\b(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|UNION ALL|UNION)\b/gi;
  const logicalKeywords = /\b(AND|OR|AS|ON|IN|IS|NOT|NULL|CASE|WHEN|THEN|ELSE|END)\b/gi;
  const normalizeKeyword = (keyword: string): string => uppercase ? keyword.toUpperCase() : keyword.toLowerCase();
  return source.replace(/\s+/g, " ").replace(majorKeywords, (keyword) => `\n${normalizeKeyword(keyword)}`).replace(logicalKeywords, normalizeKeyword).trim().split("\n").map((line) => line.trim()).join("\n");
};

export const formatSource = (language: FormatterLanguage, source: string, options: FormatterOptions = { tabSize: 2, quoteStyle: "DOUBLE", semicolons: true, sqlUppercase: true }): string => {
  if (!source.trim()) return "";
  if (language === "JSON") return JSON.stringify(JSON.parse(source), null, options.tabSize);
  if (language === "HTML") return source.replace(/>\s*</g, ">\n<").split("\n").map((line) => line.trim()).join("\n");
  if (language === "CSS") return indentBraces(source, options);
  if (language === "JAVASCRIPT" || language === "TYPESCRIPT") {
    let result = indentBraces(source, options);
    if (!options.semicolons) result = result.replace(/;(?=\s*$)/gm, "");
    if (options.quoteStyle === "SINGLE") result = result.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, content: string) => `'${content.replace(/'/g, "\\'")}'`);
    return result;
  }
  if (language === "MARKDOWN") return source.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n").trim();
  return formatSql(source, options.sqlUppercase);
};

export const minifySource = (language: FormatterLanguage, source: string): string => {
  if (!source.trim()) return "";
  if (language === "JSON") return JSON.stringify(JSON.parse(source));
  if (language === "MARKDOWN") return source.replace(/\n{3,}/g, "\n\n").trim();
  if (language === "HTML") return source.replace(/<!--[^]*?-->/g, "").replace(/>\s+</g, "><").trim();
  return source.replace(/\/\*[^]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1").replace(/\s+/g, " ").replace(/\s*([{};,:=+])\s*/g, "$1").trim();
};
