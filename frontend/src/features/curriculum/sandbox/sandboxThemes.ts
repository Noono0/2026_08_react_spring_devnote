/**
 * sandboxThemes.ts — 사이트 안 편집기(Sandpack)의 색 테마
 *
 * 테마 하나는 두 부분의 색을 함께 정한다.
 *   editorTheme : 왼쪽 코드 편집기·콘솔의 배경과 글자(문법 강조) 색 → SandpackProvider의 theme으로 넘긴다
 *   preview     : 오른쪽 미리보기(iframe 안 예제 화면)의 배경과 글자 색 → /styles.css 맨 위 CSS 변수로 넣는다
 *
 * ★ 배경만 바꾸면 글자가 안 보일 수 있다(어두운 배경 + 어두운 글자).
 *   그래서 배경·글자·테두리·강조색을 한 묶음(팔레트)으로 정해 함께 바꾼다.
 */
import type { SandpackThemeProp } from "@codesandbox/sandpack-react";

/** 사용자가 고르는 값. "site"는 사이트 밝게/어둡게 설정을 그대로 따른다. */
export const sandboxThemeChoices = ["site", "light", "dark", "sepia", "navy"] as const;
export type SandboxThemeChoice = (typeof sandboxThemeChoices)[number];
/** "site"를 실제 색으로 바꾼 뒤의 테마 이름 */
export type SandboxThemeName = Exclude<SandboxThemeChoice, "site">;

export const sandboxThemeLabels: Record<SandboxThemeChoice, string> = {
  site: "사이트 테마 따라가기",
  light: "밝게",
  dark: "어둡게",
  sepia: "베이지 (눈 편한)",
  navy: "남색 밤",
};

/** localStorage 같은 믿을 수 없는 문자열이 우리가 아는 테마 값인지 확인한다. */
export const isSandboxThemeChoice = (value: unknown): value is SandboxThemeChoice =>
  typeof value === "string" && (sandboxThemeChoices as readonly string[]).includes(value);

/** "site"면 사이트 테마(light/dark)로, 나머지는 그대로 쓴다. */
export const resolveSandboxTheme = (choice: SandboxThemeChoice, siteTheme: "light" | "dark"): SandboxThemeName =>
  choice === "site" ? siteTheme : choice;

/** 미리보기 예제 화면의 색 묶음 */
interface PreviewPalette {
  background: string; // 페이지 배경
  surface: string; // 카드·표·입력칸 배경
  text: string; // 본문 글자
  subText: string; // 설명(p) 글자
  muted: string; // 흐린 글자(.muted)
  border: string;
  borderSoft: string; // 목록 구분선
  accent: string; // 버튼·강조
  accentSoft: string; // 배지 배경
  danger: string;
  ok: string;
}

const previewPalettes: Record<SandboxThemeName, PreviewPalette> = {
  light: { background: "#f6f8fb", surface: "#ffffff", text: "#1d2433", subText: "#5b677a", muted: "#8a94a6", border: "#dce3ed", borderSoft: "#eef1f6", accent: "#3461ff", accentSoft: "#eaf0ff", danger: "#d63b4c", ok: "#16875b" },
  dark: { background: "#151a23", surface: "#1f2632", text: "#e6ebf2", subText: "#aab4c3", muted: "#7f8a9c", border: "#334055", borderSoft: "#273142", accent: "#6d8bff", accentSoft: "#26315a", danger: "#f06676", ok: "#4cc38a" },
  sepia: { background: "#f4ecd8", surface: "#fbf6ea", text: "#433422", subText: "#6b5a43", muted: "#8f7d63", border: "#dccdae", borderSoft: "#e8dcc3", accent: "#a0612b", accentSoft: "#efdcc4", danger: "#b8433a", ok: "#4f7d3a" },
  navy: { background: "#0f1b33", surface: "#17264a", text: "#e4ecff", subText: "#a9b8d9", muted: "#7f8fb3", border: "#2c3f6b", borderSoft: "#22335a", accent: "#ffb547", accentSoft: "#3a3a2e", danger: "#ff7a85", ok: "#5fd3a0" },
};

/** 왼쪽 편집기·콘솔 색. 밝게/어둡게는 Sandpack 기본 테마를, 나머지는 직접 정한 색을 쓴다. */
export const sandboxEditorThemes: Record<SandboxThemeName, SandpackThemeProp> = {
  light: "light",
  dark: "dark",
  sepia: {
    colors: { surface1: "#fbf6ea", surface2: "#e8dcc3", surface3: "#efe4cd", clickable: "#8f7d63", base: "#433422", disabled: "#b5a688", hover: "#433422", accent: "#a0612b" },
    syntax: { plain: "#433422", comment: { color: "#9a8a70", fontStyle: "italic" }, keyword: "#a33d6b", tag: "#2f6f8f", punctuation: "#6b5a43", definition: "#7a5a12", property: "#2f6f8f", static: "#a0612b", string: "#4f7d3a" },
  },
  navy: {
    colors: { surface1: "#0f1b33", surface2: "#22335a", surface3: "#17264a", clickable: "#a9b8d9", base: "#e4ecff", disabled: "#56688f", hover: "#ffffff", accent: "#ffb547" },
    syntax: { plain: "#e4ecff", comment: { color: "#7f8fb3", fontStyle: "italic" }, keyword: "#c792ea", tag: "#7fdbca", punctuation: "#a9b8d9", definition: "#82aaff", property: "#7fdbca", static: "#ffb547", string: "#c3e88d" },
  },
};

/**
 * 미리보기에 넣을 /styles.css 내용을 만든다.
 * 색은 맨 위 :root의 CSS 변수에만 있고, 아래 규칙은 변수만 쓰므로 테마를 바꾸면 변수 값만 달라진다.
 * 예제 코드는 이 클래스 이름(card, row, list, muted …)만 쓴다.
 */
export const createSandboxStyles = (themeName: SandboxThemeName): string => {
  const palette = previewPalettes[themeName];
  return `
:root {
  color-scheme: ${themeName === "dark" || themeName === "navy" ? "dark" : "light"};
  --background: ${palette.background}; --surface: ${palette.surface}; --text: ${palette.text}; --sub-text: ${palette.subText};
  --muted: ${palette.muted}; --border: ${palette.border}; --border-soft: ${palette.borderSoft};
  --accent: ${palette.accent}; --accent-soft: ${palette.accentSoft}; --danger: ${palette.danger}; --ok: ${palette.ok};
}
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; font-family: system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: var(--text); background: var(--background); line-height: 1.5; }
h1 { margin: 0 0 6px; font-size: 20px; }
h2 { margin: 16px 0 8px; font-size: 16px; }
p { margin: 4px 0 10px; color: var(--sub-text); }
button { padding: 6px 12px; border: 1px solid var(--accent); border-radius: 8px; color: #fff; background: var(--accent); font: inherit; cursor: pointer; }
button.secondary { color: var(--accent); background: var(--surface); }
button.danger { border-color: var(--danger); background: var(--danger); }
button:disabled { opacity: .5; cursor: not-allowed; }
input, select, textarea { padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); background: var(--surface); font: inherit; }
label { display: grid; gap: 4px; margin: 6px 0; font-size: 14px; }
.card { margin: 10px 0; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.list { margin: 0; padding: 0; list-style: none; }
.list li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border-soft); }
.muted { color: var(--muted); font-size: 13px; }
.error { color: var(--danger); font-size: 13px; }
.ok { color: var(--ok); font-size: 13px; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 999px; color: var(--accent); background: var(--accent-soft); font-size: 12px; }
table { width: 100%; border-collapse: collapse; background: var(--surface); }
th, td { padding: 6px 8px; border: 1px solid var(--border); text-align: left; font-size: 14px; }
`;
};
