import { fireEvent, render, screen } from "@testing-library/react";
import { MarkdownEditorPage } from "@/features/utility/pages/MarkdownEditorPage";

describe("MarkdownEditorPage", () => {
  it("선택한 글자에 굵게를 적용하고 미리보기에 반영한다", () => {
    render(<MarkdownEditorPage />);
    const editor = screen.getByRole("textbox", { name: "Markdown 입력" });
    fireEvent.change(editor, { target: { value: "선택 글자" } });
    (editor as HTMLTextAreaElement).setSelectionRange(0, 5);
    fireEvent.select(editor);

    fireEvent.click(screen.getByRole("button", { name: "굵게 적용" }));

    expect(editor).toHaveValue("**선택 글자**");
    expect(screen.getByText("선택 글자", { selector: ".markdown-preview strong" })).toBeInTheDocument();
  });

  it("선택한 여러 줄을 H2 제목으로 바꾼다", () => {
    render(<MarkdownEditorPage />);
    const editor = screen.getByRole("textbox", { name: "Markdown 입력" });
    fireEvent.change(editor, { target: { value: "첫 번째\n두 번째" } });
    (editor as HTMLTextAreaElement).setSelectionRange(0, 9);
    fireEvent.select(editor);

    fireEvent.click(screen.getByRole("button", { name: "제목 2단계 적용" }));

    expect(editor).toHaveValue("## 첫 번째\n## 두 번째");
    expect(screen.getByRole("heading", { level: 2, name: "첫 번째" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "두 번째" })).toBeInTheDocument();
  });

  it("할 일 목록과 표를 툴바에서 삽입한다", () => {
    render(<MarkdownEditorPage />);
    const editor = screen.getByRole("textbox", { name: "Markdown 입력" });
    fireEvent.change(editor, { target: { value: "새 할 일" } });
    (editor as HTMLTextAreaElement).setSelectionRange(0, 4);
    fireEvent.select(editor);

    fireEvent.click(screen.getByRole("button", { name: "할 일 목록 적용" }));
    expect(editor).toHaveValue("- [ ] 새 할 일");
    expect(screen.getByRole("checkbox", { name: "미완료" })).toBeDisabled();

    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "표 삽입" }));
    expect((editor as HTMLTextAreaElement).value).toContain("| :--- | :---: | ---: |");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("Ctrl+Z로 실행 취소하고 Ctrl+Y로 다시 실행한다", () => {
    render(<MarkdownEditorPage />);
    const editor = screen.getByRole("textbox", { name: "Markdown 입력" });
    fireEvent.change(editor, { target: { value: "되돌릴 글자" } });
    (editor as HTMLTextAreaElement).setSelectionRange(0, 6);
    fireEvent.select(editor);
    fireEvent.click(screen.getByRole("button", { name: "굵게 적용" }));
    expect(editor).toHaveValue("**되돌릴 글자**");

    fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
    expect(editor).toHaveValue("되돌릴 글자");
    expect(screen.getByRole("button", { name: "다시 실행" })).toBeEnabled();

    fireEvent.keyDown(editor, { key: "y", ctrlKey: true });
    expect(editor).toHaveValue("**되돌릴 글자**");
  });
});
