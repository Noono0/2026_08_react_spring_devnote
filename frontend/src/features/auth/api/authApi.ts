/**
 * ============================================================================
 * authApi.ts — 로그인·회원가입·로그아웃 API
 * ============================================================================
 *
 * documentApi.ts와 같은 역할이지만 훨씬 짧다.
 * 함수가 단순해서 한 줄씩 압축해 썼다.
 *
 * [한 줄 코드 읽는 법]
 *   (await selectedHttpClient.get<ApiResponse<AuthSession>>("/auth/session")).data
 *    └──────────────── 응답 봉투를 받아서 ────────────────┘ └ 알맹이만 꺼낸다
 *
 *   await 전체를 소괄호로 감싼 뒤 `.data`를 붙였다.
 *   소괄호가 없으면 `.data`가 Promise에 붙어 버려 undefined가 된다.
 *
 * ★★ 로그인에서 가장 중요한 것: 토큰이 코드에 안 보인다는 점
 *   여기 어디에도 토큰을 저장하거나 헤더에 붙이는 코드가 없다.
 *   이 프로젝트는 서버가 발급한 세션 쿠키로 인증하기 때문이다.
 *
 *   [왜 localStorage에 토큰을 저장하지 않을까?]
 *     localStorage는 JavaScript로 아무나 읽을 수 있다.
 *     XSS 공격이 한 번이라도 성공하면 토큰이 통째로 털린다.
 *     반면 HttpOnly 쿠키는 JavaScript가 읽을 수 없어서 훔칠 수 없다.
 *     브라우저가 요청마다 알아서 실어 보낸다.
 *     (HttpClient의 withCredentials / credentials:"include" 설정이 그 역할이다)
 *
 *   ★ "인증 정보는 되도록 JavaScript가 못 만지게 둔다"가 안전한 방향이다.
 *
 *   [이 프로젝트의 실제 설정 — backend/src/main/resources/application.yml]
 *     http-only: true      → JavaScript에서 쿠키를 읽을 수 없다
 *     same-site: strict    → 다른 사이트에서 온 요청에는 쿠키를 안 실어 보낸다 (CSRF 방어)
 *     secure: 환경변수      → 운영에서는 HTTPS에서만 쿠키를 전송한다
 *     timeout: 30m         → 기본 세션 유지 시간
 *     auth.remember-me-duration: 30d → "자동 로그인"을 켰을 때의 유지 기간
 *   백엔드 AuthenticationService가 setMaxInactiveInterval로 이 값을 적용한다.
 *   즉 자동 로그인은 비밀번호를 기억하는 게 아니라 "세션을 오래 유지"하는 것이다.
 */

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { AuthSession, LoginRequest, RegisterRequest } from "@/features/auth/types/authTypes";

/** 현재 로그인 상태를 조회한다. 비로그인이어도 오류가 아니라 정상 응답이 온다. */
export const getAuthSession = async (): Promise<AuthSession> => (await selectedHttpClient.get<ApiResponse<AuthSession>>("/auth/session")).data;

/** 로그인. 성공하면 서버가 세션 쿠키를 심어 주고 세션 정보를 돌려준다. */
export const login = async (request: LoginRequest): Promise<AuthSession> => (await selectedHttpClient.post<LoginRequest, ApiResponse<AuthSession>>("/auth/login", request)).data;

/** 회원가입. 가입과 동시에 로그인 처리되어 세션이 돌아온다. */
export const register = async (request: RegisterRequest): Promise<AuthSession> => (await selectedHttpClient.post<RegisterRequest, ApiResponse<AuthSession>>("/auth/register", request)).data;

/**
 * 로그아웃.
 *
 * ★ POST가 아니라 DELETE를 쓴 점에 주목.
 *   "세션이라는 자원을 삭제한다"는 뜻이므로 REST 관점에서 DELETE가 자연스럽다.
 *   응답으로는 "비로그인 상태의 세션 정보"가 돌아와서
 *   화면이 그걸 그대로 캐시에 넣으면 즉시 로그아웃 상태가 반영된다.
 */
export const logout = async (): Promise<AuthSession> => (await selectedHttpClient.delete<ApiResponse<AuthSession>>("/auth/session")).data;
