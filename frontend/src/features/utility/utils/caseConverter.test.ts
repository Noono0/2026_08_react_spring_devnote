import { convertCase } from "./caseConverter";

describe("convertCase", () => {
  it("공백과 기존 camelCase를 여러 표기법으로 변환한다", () => {
    expect(convertCase("devNote developer tools")).toEqual({
      camel: "devNoteDeveloperTools",
      pascal: "DevNoteDeveloperTools",
      snake: "dev_note_developer_tools",
      kebab: "dev-note-developer-tools",
      constant: "DEV_NOTE_DEVELOPER_TOOLS",
    });
  });
});
