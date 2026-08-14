export type DependencyEcosystem = "NPM" | "GRADLE";
export type DependencyScope = "PRODUCTION" | "DEVELOPMENT" | "PEER" | "OPTIONAL" | "TRANSITIVE" | "IMPLEMENTATION" | "API" | "COMPILE_ONLY" | "RUNTIME" | "TEST" | "ANNOTATION" | "RESOLVED";

export interface AnalyzedDependency {
  id: string;
  name: string;
  requestedVersion: string;
  resolvedVersion?: string;
  scope: DependencyScope;
  direct: boolean;
  sourcePath?: string;
}

export interface DependencyConflict {
  name: string;
  versions: string[];
  occurrences: number;
}

export interface DependencyAnalysisResult {
  ecosystem: DependencyEcosystem;
  projectName: string;
  projectVersion: string;
  dependencies: AnalyzedDependency[];
  conflicts: DependencyConflict[];
  warnings: string[];
  sourceKind: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const asStringRecord = (value: unknown): Record<string, string> => isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};

const npmScopes: Array<{ key: string; scope: DependencyScope }> = [
  { key: "dependencies", scope: "PRODUCTION" }, { key: "devDependencies", scope: "DEVELOPMENT" }, { key: "peerDependencies", scope: "PEER" }, { key: "optionalDependencies", scope: "OPTIONAL" },
];

const buildConflicts = (dependencies: AnalyzedDependency[]): DependencyConflict[] => {
  const grouped = new Map<string, { versions: Set<string>; count: number }>();
  dependencies.forEach((dependency) => {
    const version = dependency.resolvedVersion || dependency.requestedVersion;
    if (!version) return;
    const current = grouped.get(dependency.name) ?? { versions: new Set<string>(), count: 0 };
    current.versions.add(version); current.count += 1; grouped.set(dependency.name, current);
  });
  return [...grouped.entries()].filter(([, value]) => value.versions.size > 1).map(([name, value]) => ({ name, versions: [...value.versions].sort(), occurrences: value.count })).sort((left, right) => right.versions.length - left.versions.length || left.name.localeCompare(right.name));
};

const npmPackageNameFromPath = (path: string): string => {
  const parts = path.split("node_modules/").filter(Boolean);
  return parts.at(-1) ?? path;
};

const analyzeNpmJson = (root: Record<string, unknown>): DependencyAnalysisResult => {
  const packages = isRecord(root.packages) ? root.packages : undefined;
  const isLockFile = Boolean(packages) || typeof root.lockfileVersion === "number";
  const rootPackage = packages && isRecord(packages[""]) ? packages[""] : root;
  const directScopeMap = new Map<string, DependencyScope>();
  npmScopes.forEach(({ key, scope }) => Object.keys(asStringRecord(rootPackage[key])).forEach((name) => directScopeMap.set(name, scope)));
  const dependencies: AnalyzedDependency[] = [];
  if (packages) {
    Object.entries(packages).forEach(([path, packageValue]) => {
      if (!path || !path.includes("node_modules/") || !isRecord(packageValue)) return;
      const name = typeof packageValue.name === "string" ? packageValue.name : npmPackageNameFromPath(path);
      const direct = directScopeMap.has(name) && path === `node_modules/${name}`;
      dependencies.push({ id: `npm:${path}`, name, requestedVersion: direct ? asStringRecord(rootPackage[directScopeMap.get(name) === "DEVELOPMENT" ? "devDependencies" : directScopeMap.get(name) === "PEER" ? "peerDependencies" : directScopeMap.get(name) === "OPTIONAL" ? "optionalDependencies" : "dependencies"])[name] ?? "" : "", resolvedVersion: typeof packageValue.version === "string" ? packageValue.version : undefined, scope: direct ? directScopeMap.get(name) ?? "PRODUCTION" : "TRANSITIVE", direct, sourcePath: path });
    });
  } else {
    npmScopes.forEach(({ key, scope }) => Object.entries(asStringRecord(root[key])).forEach(([name, version]) => dependencies.push({ id: `npm:${scope}:${name}`, name, requestedVersion: version, scope, direct: true })));
  }
  const warnings: string[] = [];
  if (!isLockFile) warnings.push("package.json만 분석해 간접 의존성과 실제 설치 버전은 표시할 수 없습니다.");
  if (dependencies.length === 0) warnings.push("dependencies 또는 package-lock의 package 정보를 찾지 못했습니다.");
  return { ecosystem: "NPM", projectName: typeof rootPackage.name === "string" ? rootPackage.name : "NPM Project", projectVersion: typeof rootPackage.version === "string" ? rootPackage.version : "", dependencies, conflicts: buildConflicts(dependencies), warnings, sourceKind: isLockFile ? "package-lock.json" : "package.json" };
};

const gradleScopeMap: Record<string, DependencyScope> = {
  implementation: "IMPLEMENTATION", api: "API", compileOnly: "COMPILE_ONLY", runtimeOnly: "RUNTIME", testImplementation: "TEST", testRuntimeOnly: "TEST", annotationProcessor: "ANNOTATION", kapt: "ANNOTATION",
};

const analyzeGradle = (source: string): DependencyAnalysisResult => {
  const dependencies: AnalyzedDependency[] = [];
  const warnings: string[] = [];
  const reportLines = source.split(/\r?\n/).filter((line) => /[+\\]---/.test(line));
  if (reportLines.length > 0) {
    reportLines.forEach((line, index) => {
      const match = line.match(/(?:\+---|\\---)\s+([\w.-]+):([\w.-]+):([^\s(*)]+)(?:\s+->\s+([^\s(*)]+))?/);
      if (!match?.[1] || !match[2] || !match[3]) return;
      const prefix = line.slice(0, line.indexOf(match[1]));
      const depth = (prefix.match(/\|/g)?.length ?? 0) + (prefix.match(/ {5}/g)?.length ?? 0);
      dependencies.push({ id: `gradle-report:${index}`, name: `${match[1]}:${match[2]}`, requestedVersion: match[3], resolvedVersion: match[4] ?? match[3], scope: "RESOLVED", direct: depth === 0, sourcePath: `depth ${depth}` });
    });
  } else {
    const declarationPattern = /\b(implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|annotationProcessor|kapt)\s*(?:\(\s*)?["']([^:"']+):([^:"']+):([^"']+)["']\s*\)?/g;
    let match: RegExpExecArray | null;
    while ((match = declarationPattern.exec(source)) !== null) {
      if (!match[1] || !match[2] || !match[3] || !match[4]) continue;
      dependencies.push({ id: `gradle:${match.index}`, name: `${match[2]}:${match[3]}`, requestedVersion: match[4], scope: gradleScopeMap[match[1]] ?? "IMPLEMENTATION", direct: true });
    }
    warnings.push("build.gradle 선언만 분석해 간접 의존성과 실제 선택된 버전은 표시할 수 없습니다. gradlew dependencies 결과를 붙여 넣으면 해석 버전을 확인할 수 있습니다.");
  }
  if (dependencies.length === 0) throw new Error("Gradle 의존성 선언 또는 dependency report 항목을 찾지 못했습니다.");
  const projectName = source.match(/rootProject\.name\s*=\s*["']([^"']+)["']/)?.[1] ?? "Gradle Project";
  return { ecosystem: "GRADLE", projectName, projectVersion: source.match(/\bversion\s*=\s*["']([^"']+)["']/)?.[1] ?? "", dependencies, conflicts: buildConflicts(dependencies), warnings, sourceKind: reportLines.length > 0 ? "Gradle dependency report" : "build.gradle" };
};

export const analyzeDependencySource = (source: string): DependencyAnalysisResult => {
  if (!source.trim()) throw new Error("package.json, package-lock.json, build.gradle 또는 dependencies 결과를 입력해 주세요.");
  if (new Blob([source]).size > 8 * 1024 * 1024) throw new Error("의존성 입력은 8MB 이하만 처리할 수 있습니다.");
  if (source.trim().startsWith("{")) {
    let parsed: unknown;
    try { parsed = JSON.parse(source); } catch (error) { throw new Error(error instanceof SyntaxError ? `JSON 문법 오류: ${error.message}` : "JSON을 해석할 수 없습니다."); }
    if (!isRecord(parsed)) throw new Error("NPM 파일의 최상위 값은 객체여야 합니다.");
    return analyzeNpmJson(parsed);
  }
  return analyzeGradle(source);
};

export const describeVersionRange = (version: string): string => {
  if (!version) return "Lock 파일에서만 확인";
  if (version.startsWith("^")) return "같은 major 안에서 업데이트 허용";
  if (version.startsWith("~")) return "같은 minor 안에서 업데이트 허용";
  if (/^(?:workspace:|file:|link:)/.test(version)) return "로컬 또는 Workspace 패키지";
  if (/^(?:https?:|git\+|github:)/.test(version)) return "URL 또는 Git 소스";
  if (version === "*" || version === "latest") return "범위 제한이 거의 없음";
  if (/^\d+(?:\.\d+){0,2}(?:[-+].*)?$/.test(version)) return "고정 버전";
  return "사용자 정의 버전 범위";
};

export const createDependencyMarkdown = (result: DependencyAnalysisResult): string => [
  `# ${result.projectName} 의존성 분석`, "", `- 생태계: ${result.ecosystem}`, `- 입력: ${result.sourceKind}`, `- 전체 항목: ${result.dependencies.length}`, `- 직접 의존성: ${result.dependencies.filter((item) => item.direct).length}`, `- 중복 버전 후보: ${result.conflicts.length}`, "", "## 직접 의존성", "", ...result.dependencies.filter((item) => item.direct).map((item) => `- \`${item.name}\` ${item.requestedVersion || item.resolvedVersion || ""} (${item.scope})`), "", "## 중복 버전 후보", "", ...(result.conflicts.length > 0 ? result.conflicts.map((item) => `- \`${item.name}\`: ${item.versions.join(", ")}`) : ["- 없음"]),
].join("\n");
