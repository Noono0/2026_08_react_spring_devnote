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
          proxyServer.on("error", (proxyError, request, response) => {
            console.error("[ViteProxy] 백엔드 연결 실패", {
              requestUrl: request.url,
              proxyError,
            });
            // 기본 동작은 설명 없는 HTTP 500이라 원인을 알 수 없다.
            // 백엔드가 꺼져 있거나 아직 시작 중이라는 사실을 화면에서 알 수 있도록 502와 설명을 돌려준다.
            if (!("writeHead" in response) || response.headersSent) return;
            response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({
              status: 502,
              errorCode: "BACKEND_UNREACHABLE",
              detail: "개발 서버(Vite)가 백엔드 http://localhost:8080 에 연결하지 못했습니다. 백엔드가 꺼져 있거나 아직 시작 중입니다.",
              suggestedAction: "devnote-backend 창에서 'Started' 문구가 나왔는지, 오류로 멈추지 않았는지 확인해 주세요.",
              fieldErrors: [],
            }));
          });
        },
      },
    },
  },
});
