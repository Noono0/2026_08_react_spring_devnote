/**
 * ============================================================================
 * useAuthSession.ts — 로그인 상태를 다루는 훅 모음
 * ============================================================================
 *
 * ★ 이 파일에서 배울 핵심: "로그인 상태를 전역 State가 아니라 Query로 관리한다"
 *
 * [흔한 방식과 비교]
 *   많은 초보 프로젝트가 Context나 Zustand에 로그인 정보를 담는다.
 *   그런데 로그인 상태는 사실 "서버가 갖고 있는 데이터"다.
 *     - 세션이 서버에서 만료될 수 있다
 *     - 관리자가 계정을 정지시킬 수 있다
 *     - 다른 탭에서 로그아웃했을 수 있다
 *   전역 State에 복사해 두면 서버의 진실과 어긋나기 시작한다.
 *
 *   TanStack Query로 관리하면
 *     - 캐시가 있어 여러 컴포넌트가 써도 요청은 한 번만 나간다
 *     - 필요할 때 다시 확인할 수 있다
 *     - 로그인/로그아웃 후 관련 데이터를 함께 갱신하기 쉽다
 *
 * [이 파일이 제공하는 것]
 *   useAuthSessionQuery  — 지금 로그인 상태 조회 (앱 곳곳에서 씀)
 *   useLoginMutation     — 로그인
 *   useRegisterMutation  — 회원가입
 *   useLogoutMutation    — 로그아웃
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthSession, login, logout, register } from "@/features/auth/api/authApi";

// 세션 캐시의 키. 여러 훅이 같은 키를 써야 하므로 상수로 뺐다.
export const authSessionQueryKey = ["auth", "session"] as const;

/**
 * ★★ 로그인 상태가 바뀌었을 때 "권한에 따라 내용이 달라지는" 데이터를 전부 갱신한다.
 *
 * [왜 필요한가? — 이걸 빠뜨리면 생기는 실제 버그]
 *   1) 손님 상태로 문서 목록을 본다 → 공개 문서 5건이 캐시에 저장됨
 *   2) 관리자로 로그인한다
 *   3) 목록을 다시 봐도 여전히 5건만 보인다!
 *      → 캐시가 살아 있어서 새로 요청하지 않기 때문이다.
 *
 *   반대로 로그아웃했을 때가 더 심각하다.
 *   관리자만 볼 수 있던 데이터가 캐시에 남아 손님 화면에 그대로 보인다.
 *   ★ 이건 단순 버그가 아니라 정보 노출 사고다.
 *
 *   그래서 로그인/로그아웃/가입 직후에는 권한에 영향받는 캐시를 전부 무효화한다.
 *
 * [Promise.all이란?]
 *   여러 비동기 작업을 "동시에" 실행하고 전부 끝날 때까지 기다린다.
 *   하나씩 await하면 세 번을 순서대로 기다리지만,
 *   Promise.all은 세 개를 한꺼번에 보내므로 훨씬 빠르다.
 */
const resetAuthenticatedQueries = async (queryClient: ReturnType<typeof useQueryClient>): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["portfolio", "sections"] }),
    queryClient.invalidateQueries({ queryKey: ["admin"] }),
    queryClient.invalidateQueries({ queryKey: ["documents"] }),
  ]);
};

/**
 * 현재 로그인 상태를 조회한다.
 *
 * ★ `retry: false` 가 중요하다.
 *   기본 설정대로면 실패 시 두 번 더 재시도한다.
 *   하지만 "로그인 안 됨(401)"은 재시도해도 결과가 같다.
 *   괜히 요청만 세 번 나가고 화면 표시도 그만큼 늦어진다.
 *   인증 관련 쿼리는 재시도를 끄는 게 일반적이다.
 *
 * ★ 이 훅은 사이드바, 헤더, 라우트 보호 등 여러 곳에서 동시에 호출된다.
 *   그래도 서버 요청은 한 번만 나간다. 같은 queryKey를 공유하기 때문이다.
 *   이것이 Query 캐시의 큰 장점이다.
 */
export const useAuthSessionQuery = () => useQuery({ queryKey: authSessionQueryKey, queryFn: getAuthSession, retry: false });

/**
 * 로그인.
 *
 * ★ onSuccess에서 두 가지를 순서대로 한다.
 *   1) setQueryData로 세션 캐시를 즉시 갱신
 *      → 서버가 방금 최신 세션을 줬으므로 다시 물어볼 필요가 없다.
 *        화면이 지연 없이 로그인 상태로 바뀐다.
 *   2) 권한 의존 데이터를 무효화
 *      → 이제 볼 수 있는 것이 달라졌으므로 다시 받아야 한다.
 */
export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: login, onSuccess: async (session) => { queryClient.setQueryData(authSessionQueryKey, session); await resetAuthenticatedQueries(queryClient); } });
};

/** 회원가입. 가입 즉시 로그인되므로 처리 방식이 로그인과 완전히 같다. */
export const useRegisterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: register, onSuccess: async (session) => { queryClient.setQueryData(authSessionQueryKey, session); await resetAuthenticatedQueries(queryClient); } });
};

/**
 * 로그아웃.
 *
 * ★ 로그인과 코드가 똑같다는 점이 재미있다.
 *   서버가 "비로그인 상태의 세션"을 돌려주므로 그걸 그대로 캐시에 넣으면 되고,
 *   권한 의존 데이터를 지우는 것도 똑같이 필요하다.
 *   ★ 특히 로그아웃 시의 캐시 무효화는 보안상 반드시 해야 한다.
 *     안 하면 로그아웃 후에도 이전 사용자의 데이터가 화면에 남는다.
 */
export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: logout, onSuccess: async (session) => { queryClient.setQueryData(authSessionQueryKey, session); await resetAuthenticatedQueries(queryClient); } });
};
