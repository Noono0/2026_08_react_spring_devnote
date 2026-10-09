/**
 * sqlCodeOutput.ts — 정리한 SQL을 Java 코드 문자열로 바꾼다(dpriver의 "Output: Java / Java String Buffer"와 같은 기능)
 *
 *   JAVA_STRING          String sql = "SELECT u.id,\n"
 *                                  + "       u.name\n";
 *   JAVA_STRING_BUILDER  StringBuilder sql = new StringBuilder();
 *                        sql.append("SELECT u.id,\n");
 *
 * ★ 줄마다 "\n"을 붙이는 이유: 줄을 이어 붙였을 때 "-- 주석"이 뒤 쿼리까지 주석으로 만들지 않게 한다.
 * ★ 문자열 안의 역슬래시(\)와 큰따옴표(")는 Java 문자열이 깨지지 않게 escape한다.
 */
export type SqlOutputTarget = "SQL" | "JAVA_STRING" | "JAVA_STRING_BUILDER";

export const sqlOutputTargetLabels: Record<SqlOutputTarget, string> = {
  SQL: "SQL",
  JAVA_STRING: "Java 문자열 (+)",
  JAVA_STRING_BUILDER: "Java StringBuilder",
};

const toJavaLiteral = (line: string): string => `"${line.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}\\n"`;

export const convertSqlOutput = (sql: string, target: SqlOutputTarget): string => {
  if (target === "SQL" || !sql) return sql;
  const lines = sql.split("\n");
  if (target === "JAVA_STRING") {
    const indent = " ".repeat("String sql = ".length - 2); // "+ " 뒤 따옴표가 첫 줄 따옴표와 같은 열에 오게
    return lines.map((line, index) => `${index === 0 ? "String sql = " : `${indent}+ `}${toJavaLiteral(line)}`).join("\n").concat(";");
  }
  return ["StringBuilder sql = new StringBuilder();", ...lines.map((line) => `sql.append(${toJavaLiteral(line)});`)].join("\n");
};
