/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_HTTP_CLIENT: "axios" | "fetch";
  readonly VITE_DATA_SOURCE: "backend" | "mock";
  readonly VITE_MOCK_SCENARIO: string;
  readonly VITE_DEVELOPMENT_MEMBER_ID: string;
  readonly VITE_ENABLE_DEVELOPMENT_MENU: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
