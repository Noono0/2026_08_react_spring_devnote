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

/** import 경로 → 패키지 이름. "react-dom/client" → "react-dom", "@tanstack/react-query" → 그대로, "zustand/middleware" → "zustand" */
export const toPackageName = (specifier: string): string =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0] ?? specifier;

/**
 * 예제가 실제로 import하는 패키지만 골라 설치 목록을 만든다(react·react-dom은 항상 포함).
 *
 * ★ 왜 전부 넣지 않을까?
 *   목록의 패키지는 쓰지 않아도 편집기가 모두 내려받는다. 그중 하나라도 받기에 실패하면
 *   React만 쓰는 예제까지 미리보기가 "로딩 중"에서 멈춰 흰 화면이 된다.
 *   꼭 필요한 것만 넣으면 더 빨리 뜨고, 실패할 곳도 줄어든다.
 */
export const selectSandboxDependencies = (source: string): Record<string, string> => {
  const selected: Record<string, string> = { react: sandboxDependencies.react ?? "", "react-dom": sandboxDependencies["react-dom"] ?? "" };
  for (const match of source.matchAll(/from "([^".][^"]*)"/g)) {
    const packageName = toPackageName(match[1] ?? "");
    const version = sandboxDependencies[packageName];
    if (version) selected[packageName] = version;
  }
  return selected;
};

// 미리보기 스타일(/styles.css)은 색 테마와 함께 sandboxThemes.ts의 createSandboxStyles가 만든다.
