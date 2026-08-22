import { Editor } from "@tiptap/core";
import Table from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import {
  TableCellWithBackground,
  TableHeaderWithBackground,
} from "@/features/document/extensions/tableCellBackground";
import { TableRowWithHeight } from "@/features/document/extensions/tableRowHeight";

describe("TableRowWithHeight", () => {
  it("현재 셀이 포함된 행의 높이를 저장하고 초기화한다", () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Table,
        TableCellWithBackground,
        TableHeaderWithBackground,
        TableRowWithHeight,
      ],
      content: "<table><tbody><tr><td><p>높이 확인</p></td><td><p>같은 행</p></td></tr></tbody></table>",
    });
    let textPosition = 0;
    editor.state.doc.descendants((node, position) => {
      if (node.isText && node.text?.includes("높이 확인")) textPosition = position;
    });

    editor.commands.setTextSelection(textPosition);
    expect(editor.commands.setTableRowHeight(96)).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain('"rowHeight":96');
    expect(editor.getHTML()).toMatch(/<tr[^>]*data-row-height="96"[^>]*>/);
    expect(editor.getHTML()).toMatch(/height:\s*96px/);

    expect(editor.commands.setTableRowHeight(null)).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain('"rowHeight":null');
    expect(editor.getHTML()).not.toContain("data-row-height");
    editor.destroy();
  });
});
