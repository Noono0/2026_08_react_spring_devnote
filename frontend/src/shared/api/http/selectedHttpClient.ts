import type { HttpClient } from "./HttpClient";
import { axiosHttpClient } from "./AxiosHttpClient";
import { fetchHttpClient } from "./FetchHttpClient";
import { applicationEnvironment } from "@/shared/config/applicationEnvironment";

/**
 * 기본값은 Axios입니다. .env.development의 VITE_HTTP_CLIENT를 fetch로 바꾸면
 * Page, Hook, API Service 코드를 수정하지 않고 Fetch 구현으로 전환됩니다.
 *
 * 주석 전환 연습을 하려면 아래 삼항 연산자를 주석 처리하고 원하는 한 줄만 남겨도 됩니다.
 */
export const selectedHttpClient: HttpClient =
  applicationEnvironment.VITE_HTTP_CLIENT === "fetch" ? fetchHttpClient : axiosHttpClient;

// export const selectedHttpClient: HttpClient = axiosHttpClient;
// export const selectedHttpClient: HttpClient = fetchHttpClient;
