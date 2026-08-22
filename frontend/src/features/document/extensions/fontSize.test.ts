import TextStyle from "@tiptap/extension-text-style";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FontSizeExtension } from "@/features/document/extensions/fontSize";

describe("FontSizeExtension", () => {
  it("선택한 글자 크기를 JSON과 HTML에 저장하고 기본 크기로 되돌린다", () => {
    const editor = new Editor({
      extensions: [StarterKit, TextStyle, FontSizeExtension],
      content: "<p>글자 크기 확인</p>",
    });

    editor.commands.selectAll();
    editor.commands.setFontSize("18pt");

    expect(JSON.stringify(editor.getJSON())).toContain('"fontSize":"18pt"');
    expect(editor.getHTML()).toMatch(/font-size:\s*18pt/);

    editor.commands.unsetFontSize();

    expect(JSON.stringify(editor.getJSON())).not.toContain("fontSize");
    expect(editor.getHTML()).not.toContain("font-size");
    editor.destroy();
  });
});
