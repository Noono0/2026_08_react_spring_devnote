import { Extension } from "@tiptap/core";

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

export const isSupportedFontSize = (fontSize: string): fontSize is FontSizeValue =>
  FONT_SIZE_OPTIONS.some((supportedFontSize) => supportedFontSize === fontSize);

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
            parseHTML: (element: HTMLElement) => {
              const fontSize = element.style.fontSize;
              return isSupportedFontSize(fontSize) ? fontSize : null;
            },
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
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});
