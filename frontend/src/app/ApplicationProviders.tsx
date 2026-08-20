/**
 * ============================================================================
 * ApplicationProviders.tsx — 앱 전체가 함께 쓰는 "공용 도구"를 꽂아 주는 곳
 * ============================================================================
 *
 * [Provider가 뭔가요?]
 *   React에서 데이터를 아래로 내려 주는 기본 방법은 props다.
 *   그런데 "로그인 정보"나 "테마 색상"처럼 앱 어디서나 필요한 값을
 *   props로 내려보내려면, 중간에 있는 컴포넌트들이 자기는 쓰지도 않으면서
 *   그냥 전달만 하느라 코드가 지저분해진다. (이걸 props drilling이라고 부른다)
 *
 *   Provider는 그 문제를 해결한다.
 *   앱을 통째로 감싸 두면, 그 안의 어떤 컴포넌트든 몇 단계 아래에 있든
 *   훅 하나로(useQuery 등) 바로 꺼내 쓸 수 있다. "공용 창고"라고 생각하면 된다.
 *
 * [여기서 꽂아 주는 도구 3가지]
 *   1) QueryClientProvider — 서버 데이터 관리 (TanStack Query)
 *   2) Toaster             — 화면 구석에 뜨는 알림 메시지 (sonner)
 *   3) ReactQueryDevtools  — 개발 중에만 보이는 디버깅 패널
 */

import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { isApiErrorRetryable } from "@/shared/api/error/apiErrorHelpers";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

/**
 * QueryClient — 서버에서 받아온 데이터를 보관하는 "캐시 창고"의 본체.
 *
 * ★ 컴포넌트 바깥에 만든 이유가 중요하다.
 *   컴포넌트 함수는 화면이 다시 그려질 때마다 처음부터 다시 실행된다.
 *   만약 이 코드를 컴포넌트 안에 넣으면 다시 그릴 때마다 새 창고가 생겨서
 *   그동안 모아 둔 데이터가 통째로 날아간다.
 *   그래서 "앱이 켜질 때 딱 한 번만" 만들어지도록 파일 최상단에 둔다.
 */
const queryClient = new QueryClient({
  // defaultOptions: 앞으로 만들 모든 쿼리에 공통으로 적용할 기본 설정.
  // 물론 개별 useQuery에서 따로 지정하면 그쪽이 우선한다.
  defaultOptions: {
    queries: {
      // staleTime: "받아온 데이터를 몇 ms 동안 신선하다고 믿을까?"
      // 30초 안에 같은 데이터를 또 요청하면 서버에 안 가고 창고에서 바로 꺼내 준다.
      // 30_000 의 밑줄은 자릿수 구분용일 뿐, 30000과 완전히 같은 숫자다.
      staleTime: 30_000,

      // gcTime (garbage collection time): 아무도 안 쓰는 데이터를 몇 ms 뒤에 버릴까?
      // 화면을 떠나도 5분간은 창고에 남겨 둔다. 그 사이에 돌아오면 즉시 보여줄 수 있다.
      gcTime: 5 * 60_000,

      // 기본값은 true라서, 다른 탭 갔다가 돌아오기만 해도 자동으로 다시 요청한다.
      // 학습용으로는 "내가 안 시켰는데 왜 요청이 가지?" 하고 헷갈리기 쉬워서 꺼 뒀다.
      refetchOnWindowFocus: false,

      // retry: 요청이 실패했을 때 몇 번 더 시도할지 정하는 규칙.
      // 함수로 주면 "재시도할까 말까(true/false)"를 직접 판단할 수 있다.
      //   failureCount : 지금까지 실패한 횟수 (0부터 시작)
      //   requestError : 방금 발생한 에러 객체
      // 아래 조건 = "2번 미만으로 실패했고, 그리고(&&) 다시 시도할 가치가 있는 에러일 때만".
      //
      // 왜 무조건 재시도하면 안 되나?
      //   404(없는 문서)나 403(권한 없음)은 백 번을 다시 보내도 똑같이 실패한다.
      //   서버만 괴롭히고 사용자는 오래 기다리게 된다.
      //   반대로 500(서버 일시 오류)이나 네트워크 끊김은 재시도하면 성공할 수 있다.
      //   그 구분을 isApiErrorRetryable 함수가 담당한다.
      retry: (failureCount, requestError) =>
        failureCount < 2 && isApiErrorRetryable(requestError),
    },
    mutations: {
      // mutation = 데이터를 "바꾸는" 요청 (등록/수정/삭제).
      // 조회와 달리 자동 재시도를 끈다.
      // 안 그러면 주문이 두 번 들어가거나 글이 두 개 등록되는 사고가 날 수 있다.
      retry: false,
    },
  },
});

/**
 * children을 받아 감싸기만 하는 컴포넌트.
 *
 * `PropsWithChildren`은 React가 제공하는 타입 도우미로,
 * `{ children?: React.ReactNode }`를 자동으로 붙여 준다.
 * 즉 <ApplicationProviders> 태그 사이에 넣은 내용이 children으로 들어온다.
 */
export const ApplicationProviders = ({ children }: PropsWithChildren) => {
  // Zustand 스토어에서 현재 테마(light/dark)만 골라서 구독한다.
  // `(state) => state.applicationTheme` 처럼 필요한 조각만 집어 가는 함수를 selector라고 한다.
  // 스토어 전체를 가져오면 스토어의 아무 값이나 바뀔 때마다 이 컴포넌트가 다시 그려지지만,
  // 이렇게 하나만 집어 가면 applicationTheme이 바뀔 때만 다시 그려진다. (성능 이득)
  const applicationTheme = useApplicationUiStore((state) => state.applicationTheme);

  return (
    <QueryClientProvider client={queryClient}>
      {/* children = App.tsx에서 이 컴포넌트 안에 넣은 <BrowserRouter>...</BrowserRouter> 전체 */}
      {children}

      {/* Toaster: 알림 메시지가 실제로 "그려질 자리".
          이 태그를 어딘가 한 번 놔둬야 applicationNotification.success(...) 같은 호출이 화면에 보인다.
          - theme        : 위에서 구독한 테마를 그대로 넘겨 다크모드에서도 어울리게 한다
          - richColors   : 성공은 초록, 실패는 빨강처럼 종류별 색을 입힌다
          - visibleToasts: 한 번에 최대 5개까지만 쌓아서 보여준다 */}
      <Toaster theme={applicationTheme} position="bottom-right" richColors closeButton visibleToasts={5} />

      {/* import.meta.env.DEV 는 `npm run dev`로 개발 서버를 돌릴 때만 true다.
          `npm run build`로 배포용을 만들면 false가 되고,
          이 devtools 코드는 아예 결과물에서 제거된다(tree shaking).

          `조건 ? A : null` 패턴: 조건이 거짓일 때 아무것도 안 그리려면 null을 준다.
          참고로 `조건 && <컴포넌트 />` 로도 쓸 수 있는데,
          조건이 숫자 0이면 화면에 "0"이 찍히는 함정이 있어서 이 프로젝트는 삼항 연산자를 쓴다. */}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
};
