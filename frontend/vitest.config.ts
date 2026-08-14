import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/**
 * 단위·컴포넌트 테스트 전용 설정입니다.
 *
 * React Fast Refresh 플러그인은 테스트 실행에 필요하지 않으므로 등록하지 않습니다.
 * TSX 변환은 Vitest가 사용하는 Vite의 기본 변환기와 tsconfig의
 * jsx: react-jsx 설정으로 처리됩니다.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    /**
     * tsconfig.app.json의 types에 vitest/globals가 등록되어 있으므로
     * 런타임에서도 describe/it/expect를 전역으로 제공해야 합니다.
     * 이 값이 없으면 vitest에서 import하지 않은 테스트 파일이
     * 타입 검사만 통과하고 실행 시 ReferenceError로 실패합니다.
     */
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.ts"],
    /** 각 테스트가 남긴 mock 상태가 다음 테스트로 새지 않도록 정리합니다. */
    restoreMocks: true,
    clearMocks: true,
  },
});
