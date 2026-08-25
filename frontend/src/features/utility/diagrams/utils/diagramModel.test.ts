import { describe, expect, it } from "vitest";
import { analyzeSqlSchema } from "@/features/utility/utils/sqlSchemaAnalyzer";
import {
  convertSqlSchemaToDiagramModel,
  createEmptyDiagramModel,
  createNewTableNode,
  generateCreateTableSql,
  parseDiagramModel,
} from "./diagramModel";

const SAMPLE_DDL = `
CREATE TABLE MEMBER (
    member_id BIGINT PRIMARY KEY,
    email VARCHAR(100)
);

CREATE TABLE POST (
    post_id BIGINT PRIMARY KEY,
    member_id BIGINT,
    title VARCHAR(200),
    CONSTRAINT fk_post_member FOREIGN KEY (member_id) REFERENCES MEMBER (member_id)
);
`;

describe("SQL DDL을 다이어그램 모델로 변환한다", () => {
  it("테이블을 노드로, 외래키를 엣지로 바꾼다", () => {
    const diagramModel = convertSqlSchemaToDiagramModel(analyzeSqlSchema(SAMPLE_DDL));

    expect(diagramModel.nodes.map((node) => node.tableName)).toEqual(["MEMBER", "POST"]);
    expect(diagramModel.edges).toHaveLength(1);
    expect(diagramModel.edges[0]).toMatchObject({
      sourceNodeId: "POST",
      targetNodeId: "MEMBER",
      sourceColumnName: "member_id",
      targetColumnName: "member_id",
    });
  });

  it("기본키와 널 허용 여부를 컬럼에 담는다", () => {
    const diagramModel = convertSqlSchemaToDiagramModel(analyzeSqlSchema(SAMPLE_DDL));
    const memberNode = diagramModel.nodes.find((node) => node.tableName === "MEMBER");

    expect(memberNode?.columns[0]).toMatchObject({ columnName: "member_id", primaryKey: true });
  });

  it("노드가 겹치지 않도록 격자로 배치한다", () => {
    const diagramModel = convertSqlSchemaToDiagramModel(analyzeSqlSchema(SAMPLE_DDL));
    const positions = diagramModel.nodes.map((node) => `${node.position.x},${node.position.y}`);

    expect(new Set(positions).size).toBe(positions.length);
  });
});

describe("다이어그램 모델에서 DDL을 생성한다", () => {
  it("CREATE TABLE과 PRIMARY KEY를 만든다", () => {
    const diagramModel = convertSqlSchemaToDiagramModel(analyzeSqlSchema(SAMPLE_DDL));
    const generatedSql = generateCreateTableSql(diagramModel);

    expect(generatedSql).toContain("CREATE TABLE `MEMBER`");
    expect(generatedSql).toContain("PRIMARY KEY (`member_id`)");
  });

  it("엣지를 FOREIGN KEY 제약으로 만든다", () => {
    const diagramModel = convertSqlSchemaToDiagramModel(analyzeSqlSchema(SAMPLE_DDL));
    const generatedSql = generateCreateTableSql(diagramModel);

    expect(generatedSql).toContain("FOREIGN KEY (`member_id`) REFERENCES `MEMBER` (`member_id`)");
  });

  it("생성한 DDL을 다시 파싱해도 테이블 수가 유지된다", () => {
    // 왕복(round-trip) 검증. 변환이 한쪽으로만 맞는 게 아니라는 것을 확인한다.
    const original = convertSqlSchemaToDiagramModel(analyzeSqlSchema(SAMPLE_DDL));
    const reparsed = convertSqlSchemaToDiagramModel(analyzeSqlSchema(generateCreateTableSql(original)));

    expect(reparsed.nodes.map((node) => node.tableName)).toEqual(["MEMBER", "POST"]);
    expect(reparsed.edges).toHaveLength(1);
  });

  it("테이블이 없으면 안내 주석을 돌려준다", () => {
    expect(generateCreateTableSql(createEmptyDiagramModel())).toContain("테이블이 없습니다");
  });
});

describe("저장된 모델 JSON을 안전하게 읽는다", () => {
  it("정상 JSON을 그대로 복원한다", () => {
    const diagramModel = convertSqlSchemaToDiagramModel(analyzeSqlSchema(SAMPLE_DDL));

    expect(parseDiagramModel(JSON.stringify(diagramModel)).nodes).toHaveLength(2);
  });

  it("깨진 JSON이면 빈 모델로 시작한다", () => {
    // 저장소 값이 손상돼도 편집기가 죽지 않아야 한다.
    expect(parseDiagramModel("{망가진").nodes).toEqual([]);
  });

  it("구조가 다른 JSON이면 빈 모델로 시작한다", () => {
    expect(parseDiagramModel('{"foo":1}').nodes).toEqual([]);
  });
});

describe("새 테이블 노드를 만든다", () => {
  it("기존 이름과 겹치지 않는 이름을 고른다", () => {
    const diagramModel = createEmptyDiagramModel();
    const firstNode = createNewTableNode(diagramModel);
    const modelWithOneNode = { ...diagramModel, nodes: [firstNode] };
    const secondNode = createNewTableNode(modelWithOneNode);

    expect(secondNode.tableName).not.toBe(firstNode.tableName);
  });

  it("기본키 컬럼 하나를 포함한 채로 만들어진다", () => {
    expect(createNewTableNode(createEmptyDiagramModel()).columns[0]).toMatchObject({ primaryKey: true });
  });
});
