import { analyzeDependencySource, describeVersionRange } from "@/features/utility/utils/dependencyAnalyzer";

describe("dependencyAnalyzer", () => {
  it("package.json의 운영·개발 의존성을 구분한다", () => {
    const result = analyzeDependencySource(JSON.stringify({ name: "demo", version: "1.0.0", dependencies: { react: "^19.0.0" }, devDependencies: { vite: "~7.1.0" } }));
    expect(result.ecosystem).toBe("NPM");
    expect(result.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({ name: "react", scope: "PRODUCTION" }), expect.objectContaining({ name: "vite", scope: "DEVELOPMENT" })]));
    expect(describeVersionRange("^19.0.0")).toContain("major");
  });

  it("Gradle 선언과 dependency report의 선택 버전을 분석한다", () => {
    const build = analyzeDependencySource(`implementation("org.springframework.boot:spring-boot-starter-web:3.5.0")\ntestImplementation 'org.junit.jupiter:junit-jupiter:5.12.0'`);
    expect(build.dependencies).toHaveLength(2);
    const report = analyzeDependencySource(`+--- com.fasterxml.jackson.core:jackson-databind:2.17.0 -> 2.18.2\n\\--- org.slf4j:slf4j-api:2.0.17`);
    expect(report.dependencies[0]).toMatchObject({ name: "com.fasterxml.jackson.core:jackson-databind", requestedVersion: "2.17.0", resolvedVersion: "2.18.2" });
  });
});
