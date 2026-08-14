import { generateTestData, testDataToCsv, testDataToSql, type TestDataRule } from "@/features/utility/utils/testDataGenerator";

it("규칙에 따라 JSON·CSV·SQL용 테스트 데이터를 만든다", () => {
  const rules: TestDataRule[] = [
    { ruleId: "id", columnName: "id", type: "SEQUENCE", option: "", nullPercentage: 0, allowDuplicate: false },
    { ruleId: "role", columnName: "role", type: "ENUM", option: "USER,ADMIN", nullPercentage: 0, allowDuplicate: true },
  ];
  const rows = generateTestData(rules, 3);
  expect(rows).toHaveLength(3);
  expect(testDataToCsv(rows)).toContain("id,role");
  expect(testDataToSql(rows, "members")).toContain("INSERT INTO members");
  expect(testDataToSql(rows, "members", "MYSQL")).toContain("INSERT INTO `members` (`id`, `role`)");
});
