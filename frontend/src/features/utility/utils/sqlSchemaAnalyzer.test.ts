import { analyzeSqlSchema, compareSqlSchemas, generateMermaidErDiagram } from "@/features/utility/utils/sqlSchemaAnalyzer";

const ddl = `
CREATE TABLE member (
  member_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE post (
  post_id BIGINT PRIMARY KEY,
  member_id BIGINT NOT NULL,
  title VARCHAR(200),
  CONSTRAINT fk_post_member FOREIGN KEY (member_id) REFERENCES member(member_id)
);`;

describe("sqlSchemaAnalyzer", () => {
  it("테이블·컬럼·PK·FK를 분석한다", () => {
    const model = analyzeSqlSchema(ddl);
    expect(model.tables).toHaveLength(2);
    expect(model.tables[0]?.columns[0]).toMatchObject({ name: "member_id", primaryKey: true, autoIncrement: true });
    expect(model.tables[1]?.foreignKeys[0]).toMatchObject({ referencedTable: "member", columns: ["member_id"] });
    expect(generateMermaidErDiagram(model)).toContain("member ||--o{ post");
  });

  it("변경된 테이블과 컬럼을 비교한다", () => {
    const after = analyzeSqlSchema(ddl.replace("title VARCHAR(200)", "title VARCHAR(300),\n  content TEXT"));
    const diff = compareSqlSchemas(analyzeSqlSchema(ddl), after);
    expect(diff.changedTables[0]).toMatchObject({ table: "post", addedColumns: ["content"], changedColumns: ["title"] });
  });
});
