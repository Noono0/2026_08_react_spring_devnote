import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { JSONContent } from "@tiptap/core";
import { RichTextEditor } from "@/features/document/components/RichTextEditor";
import { normalizeSafeEditorLink } from "@/features/document/utils/editorLink";

vi.mock("@/features/file/api/fileApi", () => ({ uploadEditorImage: vi.fn() }));

describe("RichTextEditor", () => {
  it("워드프로세서형 도구 모음에서 무료 서식 기능을 사용할 수 있다", () => {
    render(<RichTextEditor handleContentChange={vi.fn()} />);

    expect(screen.getByRole("toolbar", { name: "상세 내용 서식" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "에디터 화면 배율" })).toHaveValue("100");
    expect(screen.getByRole("combobox", { name: "문단 또는 제목 선택" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "글꼴 선택" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "글자 크기 선택" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "굵게" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소선" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "밑줄" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "인라인 코드" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "번호 목록" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "할 일 목록" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "가운데 정렬" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이미지 넣기" })).toBeInTheDocument();
    expect(screen.getByLabelText("글자색과 형광펜")).toBeInTheDocument();
    expect(screen.getByLabelText("표 도구")).toBeInTheDocument();
    expect(screen.getByLabelText("서식 더보기")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "실행 취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 실행" })).toBeInTheDocument();
  });

  it("Office 방식 격자에서 선택한 4열 × 5행 머리글 표를 삽입한다", async () => {
    const changedHtml: string[] = [];
    render(
      <RichTextEditor handleContentChange={(content) => changedHtml.push(content.contentHtml)} />,
    );

    fireEvent.click(screen.getByLabelText("표 도구"));
    const selectedGridCell = screen.getByRole("gridcell", { name: "4열 5행 표 삽입" });
    fireEvent.mouseEnter(selectedGridCell);
    expect(screen.getByText("4열 × 5행")).toBeInTheDocument();
    fireEvent.click(selectedGridCell);

    await waitFor(() =>
      expect(changedHtml.some((contentHtml) => contentHtml.includes("<table"))).toBe(true),
    );
    const insertedTableHtml = changedHtml.find((contentHtml) => contentHtml.includes("<table")) ?? "";
    expect(insertedTableHtml.match(/<tr/g)).toHaveLength(5);
    expect(insertedTableHtml.match(/<th/g)).toHaveLength(4);
  });

  it("직접 입력한 행·열과 머리글 사용 여부로 큰 표를 삽입한다", async () => {
    const changedHtml: string[] = [];
    render(
      <RichTextEditor handleContentChange={(content) => changedHtml.push(content.contentHtml)} />,
    );

    fireEvent.click(screen.getByLabelText("표 도구"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "열" }), { target: { value: "4" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "행" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "첫 행을 머리글로 사용" }));
    fireEvent.click(screen.getByRole("button", { name: "입력한 크기로 표 삽입" }));

    await waitFor(() =>
      expect(changedHtml.some((contentHtml) => contentHtml.includes("<table"))).toBe(true),
    );
    const insertedTableHtml = changedHtml.find((contentHtml) => contentHtml.includes("<table")) ?? "";
    expect(insertedTableHtml.match(/<tr/g)).toHaveLength(3);
    expect(insertedTableHtml).not.toContain("<th");
    expect(insertedTableHtml.match(/<td/g)).toHaveLength(12);
  });

  it("현재 표 셀의 배경색을 적용하고 저장 HTML에 유지한다", async () => {
    const changedHtml: string[] = [];
    render(
      <RichTextEditor handleContentChange={(content) => changedHtml.push(content.contentHtml)} />,
    );

    fireEvent.click(screen.getByLabelText("표 도구"));
    fireEvent.click(screen.getByRole("gridcell", { name: "2열 2행 표 삽입" }));
    await waitFor(() => expect(changedHtml.some((contentHtml) => contentHtml.includes("<table"))).toBe(true));

    fireEvent.click(screen.getByLabelText("표 도구"));
    const yellowCellButton = screen.getByRole("button", { name: "연한 노랑 셀 배경색" });
    expect(yellowCellButton).toBeEnabled();
    fireEvent.click(yellowCellButton);

    await waitFor(() =>
      expect(changedHtml.some((contentHtml) => contentHtml.includes('data-background-color="#fff3a3"'))).toBe(true),
    );
    expect(
      changedHtml.some((contentHtml) => /background-color:\s*(#fff3a3|rgb\(255,\s*243,\s*163\))/i.test(contentHtml)),
    ).toBe(true);
  });

  it("현재 셀이 포함된 행 높이를 조절하고 저장 HTML에 유지한다", async () => {
    const changedHtml: string[] = [];
    render(
      <RichTextEditor handleContentChange={(content) => changedHtml.push(content.contentHtml)} />,
    );

    fireEvent.click(screen.getByLabelText("표 도구"));
    fireEvent.click(screen.getByRole("gridcell", { name: "2열 2행 표 삽입" }));
    await waitFor(() => expect(changedHtml.some((contentHtml) => contentHtml.includes("<table"))).toBe(true));

    fireEvent.click(screen.getByLabelText("표 도구"));
    expect(screen.getByRole("slider", { name: "선택한 행 높이 조절" })).toBeEnabled();
    fireEvent.change(screen.getByRole("spinbutton", { name: "선택한 행 높이 픽셀" }), {
      target: { value: "96" },
    });

    await waitFor(() =>
      expect(changedHtml.some((contentHtml) => contentHtml.includes('data-row-height="96"'))).toBe(true),
    );
    expect(changedHtml.some((contentHtml) => /height:\s*96px/.test(contentHtml))).toBe(true);
  });

  it("클립보드 이미지를 업로드하고 본문 JSON에 이미지 노드를 넣는다", async () => {
    const changedContents: Array<{
      contentJson: JSONContent;
      contentHtml: string;
      contentText: string;
    }> = [];
    const handleContentChange = vi.fn((content: (typeof changedContents)[number]) => {
      changedContents.push(content);
    });
    const imageFile = new File(["image"], "error-log.png", { type: "image/png" });
    const imageUploadFunction = vi.fn().mockResolvedValue({
      fileId: 4,
      originalFileName: "error-log.png",
      fileExtension: "png",
      mimeType: "image/png",
      fileSize: 5,
      fileStatus: "TEMP",
      downloadUrl: "/api/v1/files/4/download",
      contentUrl: "/api/v1/files/4/content",
    });
    const { container } = render(
      <RichTextEditor
        imageUploadFunction={imageUploadFunction}
        handleContentChange={handleContentChange}
      />,
    );
    const editableArea = container.querySelector<HTMLElement>(".ProseMirror");

    expect(editableArea).not.toBeNull();
    fireEvent.paste(editableArea!, {
      clipboardData: {
        files: [imageFile],
        getData: () => "",
      },
    });

    await waitFor(() => expect(imageUploadFunction).toHaveBeenCalledWith(imageFile));
    await waitFor(() =>
      expect(
        changedContents.some((content) => content.contentHtml.includes("/api/v1/files/4/content")),
      ).toBe(true),
    );

    const imageContent = changedContents.find((content) =>
      content.contentHtml.includes("/api/v1/files/4/content"),
    );
    expect(imageContent?.contentText).toBe("");
    expect(JSON.stringify(imageContent?.contentJson)).toContain("/api/v1/files/4/content");
  });
});

describe("normalizeSafeEditorLink", () => {
  it("프로토콜 없는 주소에는 https를 붙인다", () => {
    expect(normalizeSafeEditorLink("example.com/path")).toBe("https://example.com/path");
  });

  it("위험한 javascript 링크는 거부한다", () => {
    expect(() => normalizeSafeEditorLink("javascript:alert(1)")).toThrow();
  });
});
