import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

/**
 * 실제 React 개발 서버와 운영 빌드에서 사용하는 Vite 설정입니다.
 *
 * Vitest 설정은 vitest.config.ts로 분리했습니다.
 * 빌드 도구(Vite)와 테스트 도구(Vitest)가 서로 다른 Vite 타입을
 * 불러와 충돌하는 문제를 방지하고, 각 설정의 역할을 명확히 하기 위함입니다.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        configure: (proxyServer) => {
          proxyServer.on("proxyReq", (_proxyRequest, request) => {
            console.log("[ViteProxy] 백엔드 요청 전달", {
              requestMethod: request.method,
              requestUrl: request.url,
            });
          });
          proxyServer.on("error", (proxyError, request) => {
            console.error("[ViteProxy] 백엔드 연결 실패", {
              requestUrl: request.url,
              proxyError,
            });
          });
        },
      },
    },
  },
});
