export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | "UNKNOWN";

export interface ParsedLogEntry {
  id: string;
  lineNumber: number;
  timestamp?: string;
  level: LogLevel;
  logger?: string;
  message: string;
  raw: string;
}

export interface ParsedException {
  lineNumber: number;
  type: string;
  message: string;
  causedBy: boolean;
}

export interface ParsedStackFrame {
  lineNumber: number;
  className: string;
  methodName: string;
  fileName: string;
  sourceLine?: number;
  applicationFrame: boolean;
}

export interface LogAnalysisResult {
  entries: ParsedLogEntry[];
  exceptions: ParsedException[];
  stackFrames: ParsedStackFrame[];
  rootCause?: ParsedException;
  levelCounts: Record<LogLevel, number>;
  repeatedMessages: Array<{ message: string; count: number }>;
  sqlSignals: string[];
  sensitiveValueCount: number;
  sourceLineCount: number;
  truncated: boolean;
  redactedSource: string;
}

const levels: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL", "UNKNOWN"];
const levelPattern = /\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|SEVERE)\b/i;
const applicationPackageExclusions = /^(?:java|javax|jdk|sun|org\.springframework|org\.apache|org\.hibernate|com\.fasterxml|react|node_modules)\./;

const normalizeLevel = (value?: string): LogLevel => {
  const upper = value?.toUpperCase();
  if (upper === "WARNING") return "WARN";
  if (upper === "SEVERE") return "ERROR";
  return levels.includes(upper as LogLevel) ? upper as LogLevel : "UNKNOWN";
};

export const redactLogSecrets = (source: string): { value: string; count: number } => {
  let count = 0;
  const replace = (pattern: RegExp, replacement: string): void => { source = source.replace(pattern, (...args: unknown[]) => { count += 1; const prefix = typeof args[1] === "string" ? args[1] : ""; return `${prefix}${replacement}`; }); };
  replace(/\b(Authorization\s*[:=]\s*Bearer\s+)[A-Za-z0-9._~+/-]+/gi, "••••••••");
  replace(/\b((?:password|passwd|pwd|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret)\s*[:=]\s*)[^\s,;&]+/gi, "••••••••");
  replace(/\b()[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, "[JWT 마스킹]");
  return { value: source, count };
};

const parseLogEntry = (line: string, lineNumber: number): ParsedLogEntry | undefined => {
  const springMatch = line.match(/^\s*((?:\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?|\d{2}:\d{2}:\d{2}(?:[.,]\d+)?))\s+(?:\[[^\]]+\]\s*)?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+(?:\d+\s+---\s+\[[^\]]+\]\s+)?([^\s:]+)?\s*(?:[-:]\s*)?(.*)$/i);
  if (springMatch) return { id: `line-${lineNumber}`, lineNumber, timestamp: springMatch[1], level: normalizeLevel(springMatch[2]), logger: springMatch[3], message: springMatch[4]?.trim() ?? "", raw: line };
  const browserMatch = line.match(/^\s*(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s*[:\]-]?\s*(.*)$/i);
  if (browserMatch) return { id: `line-${lineNumber}`, lineNumber, level: normalizeLevel(browserMatch[1]), message: browserMatch[2]?.trim() ?? "", raw: line };
  const levelMatch = line.match(levelPattern);
  if (levelMatch?.[1]) return { id: `line-${lineNumber}`, lineNumber, level: normalizeLevel(levelMatch[1]), message: line.trim(), raw: line };
  return undefined;
};

export const analyzeLogs = (source: string, maximumLines = 50_000): LogAnalysisResult => {
  if (!source.trim()) throw new Error("분석할 로그 또는 Stack Trace를 입력해 주세요.");
  if (new Blob([source]).size > 5 * 1024 * 1024) throw new Error("로그는 5MB 이하로 줄여 주세요.");
  const redacted = redactLogSecrets(source);
  const allLines = redacted.value.split(/\r?\n/);
  const lines = allLines.slice(0, maximumLines);
  const entries: ParsedLogEntry[] = [];
  const exceptions: ParsedException[] = [];
  const stackFrames: ParsedStackFrame[] = [];
  const sqlSignals = new Set<string>();
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const entry = parseLogEntry(line, lineNumber);
    if (entry) entries.push(entry);
    const exceptionMatch = line.trim().match(/^(Caused by:\s*)?([A-Za-z_$][\w.$]*(?:Exception|Error|Throwable))(?:\s*:\s*(.*))?$/);
    if (exceptionMatch?.[2]) exceptions.push({ lineNumber, type: exceptionMatch[2], message: exceptionMatch[3]?.trim() ?? "", causedBy: Boolean(exceptionMatch[1]) });
    const stackMatch = line.match(/^\s*at\s+([\w$]+(?:\.[\w$]+)*)\.([\w$<>]+)\(([^():]+)(?::(\d+))?\)/);
    if (stackMatch?.[1] && stackMatch[2] && stackMatch[3]) stackFrames.push({ lineNumber, className: stackMatch[1], methodName: stackMatch[2], fileName: stackMatch[3], sourceLine: stackMatch[4] ? Number(stackMatch[4]) : undefined, applicationFrame: !applicationPackageExclusions.test(stackMatch[1]) });
    if (/SQLException|SQLSyntaxError|SQLSTATE|Unknown column|doesn['’]t exist|constraint\s+(?:fails|violation)|duplicate entry/i.test(line)) sqlSignals.add(line.trim().slice(0, 500));
  });
  const levelCounts = Object.fromEntries(levels.map((level) => [level, 0])) as Record<LogLevel, number>;
  entries.forEach((entry) => { levelCounts[entry.level] += 1; });
  const messageCounts = new Map<string, number>();
  entries.forEach((entry) => { const normalized = entry.message.replace(/\b\d{2,}\b/g, "#").replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "{uuid}"); messageCounts.set(normalized, (messageCounts.get(normalized) ?? 0) + 1); });
  const repeatedMessages = [...messageCounts.entries()].filter(([, count]) => count > 1).map(([message, count]) => ({ message, count })).sort((left, right) => right.count - left.count).slice(0, 20);
  return { entries, exceptions, stackFrames, rootCause: [...exceptions].reverse().find((exception) => exception.causedBy) ?? exceptions.at(-1), levelCounts, repeatedMessages, sqlSignals: [...sqlSignals], sensitiveValueCount: redacted.count, sourceLineCount: allLines.length, truncated: allLines.length > maximumLines, redactedSource: redacted.value };
};

export const createLogAnalysisMarkdown = (analysis: LogAnalysisResult): string => {
  const applicationFrames = analysis.stackFrames.filter((frame) => frame.applicationFrame).slice(0, 10);
  return [
    "# 로그 분석 결과", "",
    `- 분석 줄 수: ${analysis.sourceLineCount.toLocaleString("ko-KR")}`,
    `- ERROR: ${analysis.levelCounts.ERROR + analysis.levelCounts.FATAL}`,
    `- WARN: ${analysis.levelCounts.WARN}`,
    `- 민감정보 마스킹: ${analysis.sensitiveValueCount}건`, "",
    "## Root Cause", "", analysis.rootCause ? `**${analysis.rootCause.type}** ${analysis.rootCause.message}` : "Exception을 찾지 못했습니다.", "",
    "## 애플리케이션 Stack Frame", "", ...(applicationFrames.length > 0 ? applicationFrames.map((frame) => `- \`${frame.className}.${frame.methodName}(${frame.fileName}${frame.sourceLine ? `:${frame.sourceLine}` : ""})\``) : ["- 없음"]), "",
    "## SQL 신호", "", ...(analysis.sqlSignals.length > 0 ? analysis.sqlSignals.map((signal) => `- ${signal}`) : ["- 없음"]), "",
    "## 해결 과정", "", "- 원인:", "- 해결:", "- 재발 방지:",
  ].join("\n");
};
