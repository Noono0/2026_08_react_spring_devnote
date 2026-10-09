/**
 * sandboxSetup.ts — 사이트 안 편집기(Sandpack)의 공통 설정
 *
 * Sandpack은 브라우저 안에서 작은 React 프로젝트를 만들어 실행한다(번들링은 CodeSandbox가 제공하는 서버를 쓴다).
 * 이 프로젝트 내부 코드(@/shared 등)는 불러올 수 없으므로, 단계마다 혼자 동작하는 예제(examples/*.tsx)를 넣는다.
 *
 * ★ 의존성 버전은 frontend/package.json과 맞춘다. 예제가 실제 프로젝트와 같은 API로 동작해야
 *   편집기에서 배운 코드를 실제 연습 화면 코드에 그대로 옮길 수 있다.
 */

export const sandboxDependencies: Record<string, string> = {
  react: "19.2.7",
  "react-dom": "19.2.7",
  "@tanstack/react-query": "5.87.4",
  "react-hook-form": "7.62.0",
  "@hookform/resolvers": "5.2.1",
  zod: "4.1.5",
  zustand: "5.0.8",
};

/** 모든 예제가 함께 쓰는 최소 스타일. 예제 코드는 이 클래스 이름만 쓴다. */
export const sandboxStyles = `
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; font-family: system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1d2433; background: #f6f8fb; line-height: 1.5; }
h1 { margin: 0 0 6px; font-size: 20px; }
h2 { margin: 16px 0 8px; font-size: 16px; }
p { margin: 4px 0 10px; color: #5b677a; }
button { padding: 6px 12px; border: 1px solid #3461ff; border-radius: 8px; color: #fff; background: #3461ff; font: inherit; cursor: pointer; }
button.secondary { color: #3461ff; background: #fff; }
button.danger { border-color: #d63b4c; background: #d63b4c; }
button:disabled { opacity: .5; cursor: not-allowed; }
input, select, textarea { padding: 6px 8px; border: 1px solid #dce3ed; border-radius: 8px; font: inherit; }
label { display: grid; gap: 4px; margin: 6px 0; font-size: 14px; }
.card { margin: 10px 0; padding: 12px; border: 1px solid #dce3ed; border-radius: 12px; background: #fff; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.list { margin: 0; padding: 0; list-style: none; }
.list li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eef1f6; }
.muted { color: #8a94a6; font-size: 13px; }
.error { color: #d63b4c; font-size: 13px; }
.ok { color: #16875b; font-size: 13px; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 999px; color: #3461ff; background: #eaf0ff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; background: #fff; }
th, td { padding: 6px 8px; border: 1px solid #dce3ed; text-align: left; font-size: 14px; }
`;
