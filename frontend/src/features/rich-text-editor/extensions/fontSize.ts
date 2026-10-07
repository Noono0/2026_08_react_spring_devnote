/**
 * fontSize.ts — Tiptap 에디터에 "글자 크기" 기능을 더하는 확장
 *
 * Tiptap은 기능을 확장(Extension)으로 붙인다. 이 확장은
 *   1. textStyle 표시(mark)에 fontSize 속성을 추가하고(addGlobalAttributes)
 *   2. editor.chain().setFontSize("12pt") 같은 명령을 만든다(addCommands).
 */

import { Extension } from "@tiptap/core";

// 고를 수 있는 크기 목록. as const로 고정해 "8pt" | "9pt" | … 타입을 만든다.
export const FONT_SIZE_OPTIONS = [
  "8pt",
  "9pt",
  "10pt",
  "11pt",
  "12pt",
  "14pt",
  "16pt",
  "18pt",
  "20pt",
  "24pt",
  "28pt",
  "32pt",
  "36pt",
  "48pt",
  "60pt",
  "72pt",
] as const;

export type FontSizeValue = (typeof FONT_SIZE_OPTIONS)[number];

// 타입 가드(fontSize is FontSizeValue): true를 돌려주면 그 뒤 코드에서 fontSize를 FontSizeValue로 취급할 수 있다.
export const isSupportedFontSize = (fontSize: string): fontSize is FontSizeValue =>
  FONT_SIZE_OPTIONS.some((supportedFontSize) => supportedFontSize === fontSize);

// 모듈 확장(declare module): Tiptap의 명령 목록 타입에 setFontSize·unsetFontSize를 추가해 editor.commands에서 자동 완성·타입 검사가 되게 한다.
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: FontSizeValue) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * TextStyle mark에 font-size 속성을 추가합니다.
 * 화면에서 선택 가능한 값만 허용해 저장 HTML에 임의의 CSS가 들어가지 않게 합니다.
 */
export const FontSizeExtension = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            // 저장된 HTML을 다시 열 때: style="font-size: …"에서 값을 읽되, 허용 목록에 있는 값만 받는다.
            parseHTML: (element: HTMLElement) => {
              const fontSize = element.style.fontSize;
              return isSupportedFontSize(fontSize) ? fontSize : null;
            },
            // HTML로 저장할 때: 허용된 값만 style로 쓴다(임의의 CSS가 들어가는 것 방지).
            renderHTML: (attributes: Record<string, unknown>) => {
              const fontSize = typeof attributes.fontSize === "string" ? attributes.fontSize : "";
              return isSupportedFontSize(fontSize) ? { style: `font-size: ${fontSize}` } : {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          isSupportedFontSize(fontSize)
          && chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          // 크기를 지운 뒤 아무 속성도 남지 않은 textStyle 표시는 없애 HTML을 깔끔하게 유지한다.
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});
