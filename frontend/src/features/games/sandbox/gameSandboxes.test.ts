/**
 * 게임 화면 아래 "직접 만들어 보기" 예제 검사
 *
 * 예제는 Sandpack react-ts 템플릿에 /App.tsx로 들어간다 → App을 기본으로 내보내야 하고,
 * 이 프로젝트 내부 코드(@/…)나 설치하지 않은 패키지는 불러올 수 없다(편집기에는 react·react-dom만 설치).
 */
import { describe, expect, it } from "vitest";
import game2048 from "./examples/2048-slide-row.tsx?raw";
import memory from "./examples/memory-shuffle.tsx?raw";
import minesweeper from "./examples/minesweeper-reveal-area.tsx?raw";
import tetris from "./examples/tetris-clear-lines.tsx?raw";

const examples = { memory, game2048, minesweeper, tetris };

describe("게임 직접 만들어 보기 예제", () => {
  it.each(Object.entries(examples))("%s: App 기본 내보내기·해 볼 것·TODO·채점표가 있다", (_name, source) => {
    expect(source).toContain("export default function App");
    expect(source).toContain("해 볼 것");
    expect(source).toContain("TODO: 여기를 완성하세요");
    expect(source).toContain("function runChecks");
  });

  it.each(Object.entries(examples))("%s: react 말고 다른 패키지나 프로젝트 내부 코드를 불러오지 않는다", (_name, source) => {
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports).toEqual(["react"]);
  });
});
