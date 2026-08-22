import { fireEvent, render, screen, within } from "@testing-library/react";
import { DeveloperToolsPage } from "./DeveloperToolsPage";

describe("DeveloperToolsPage", () => {
  it("문자열 케이스 변환의 원본을 여러 줄 textarea로 입력받는다", () => {
    render(<DeveloperToolsPage />);

    const caseTool = screen.getByRole("heading", { name: "문자열 케이스 변환" }).closest("article");
    expect(caseTool).not.toBeNull();

    const source = within(caseTool as HTMLElement).getByRole("textbox", { name: "원본" });
    expect(source.tagName).toBe("TEXTAREA");
    expect(source).toHaveAttribute("rows", "4");

    ["camelCase", "PascalCase", "snake_case", "kebab-case", "CONSTANT_CASE"].forEach((label) => {
      const result = within(caseTool as HTMLElement).getByRole("textbox", { name: label });
      expect(result.tagName).toBe("TEXTAREA");
      expect(result).toHaveAttribute("readonly");
      expect(result).toHaveAttribute("rows", "3");
    });
  });

  it("문자열 도구는 기본적으로 독립적이고 공유 ON일 때 공통 입력을 함께 사용한다", () => {
    render(<DeveloperToolsPage />);

    const getTool = (heading: string): HTMLElement => {
      const tool = screen.getByRole("heading", { name: heading }).closest("article");
      if (!tool) throw new Error(`${heading} 도구를 찾지 못했습니다.`);
      return tool;
    };
    const caseTool = getTool("문자열 케이스 변환");
    const base64Tool = getTool("Base64 · URL");
    const hashTool = getTool("UUID · SHA-256");
    const jsonTool = getTool("JSON String Escape");
    const caseSource = within(caseTool).getByRole("textbox", { name: "원본" });
    const base64Source = within(base64Tool).getByRole("textbox", { name: "원본" });

    expect(caseSource).not.toHaveValue((base64Source as HTMLTextAreaElement).value);

    const sharedSource = screen.getByRole("textbox", { name: "공통 원본" });
    const shareToggle = screen.getByRole("switch", { name: "문자열 도구 공통 입력 공유" });
    fireEvent.click(shareToggle);
    fireEvent.change(sharedSource, { target: { value: "shared devnote value" } });

    const sharedCaseSource = within(caseTool).getByRole("textbox", { name: /원본/ });
    const sharedBase64Source = within(base64Tool).getByRole("textbox", { name: /원본/ });
    const sharedHashSource = within(hashTool).getByRole("textbox", { name: /문자열 원본/ });
    const sharedJsonSource = within(jsonTool).getByRole("textbox", { name: /원본/ });
    [sharedCaseSource, sharedBase64Source, sharedHashSource, sharedJsonSource].forEach((source) => {
      expect(source).toHaveValue("shared devnote value");
    });
    expect(screen.getAllByText("공통 입력 사용 중")).toHaveLength(4);

    fireEvent.change(sharedCaseSource, { target: { value: "case panel shared value" } });
    expect(sharedSource).toHaveValue("case panel shared value");
    expect(sharedBase64Source).toHaveValue("case panel shared value");

    fireEvent.click(shareToggle);
    fireEvent.change(within(caseTool).getByRole("textbox", { name: "원본" }), { target: { value: "case only" } });
    expect(within(base64Tool).getByRole("textbox", { name: "원본" })).toHaveValue("case panel shared value");
  });
});
