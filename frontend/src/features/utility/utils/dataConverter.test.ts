import { generateJavaRecords, generateTypeScriptInterfaces, jsonValueToXml, jsonValueToYaml, parseSimpleYaml, parseXml, validateJsonSchema } from "@/features/utility/utils/dataConverter";

describe("dataConverter", () => {
  const data = { name: "DevNote", active: true, skills: ["React", "Spring"] };

  it("JSON과 YAML을 양방향 변환한다", () => {
    const yaml = jsonValueToYaml(data);
    expect(parseSimpleYaml(yaml)).toEqual(data);
  });

  it("JSON과 XML을 변환한다", () => {
    const xml = jsonValueToXml(data, "developer");
    expect(parseXml(xml)).toEqual({ developer: data });
  });

  it("TypeScript와 Java DTO 초안을 생성한다", () => {
    expect(generateTypeScriptInterfaces(data, "DeveloperDto")).toContain("export interface DeveloperDto");
    expect(generateJavaRecords(data, "DeveloperDto")).toContain("public record DeveloperDto");
  });

  it("JSON Schema의 type과 required를 검증한다", () => {
    const result = validateJsonSchema({ name: "DevNote" }, { type: "object", required: ["name", "active"], properties: { name: { type: "string" } } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("active");
  });
});
