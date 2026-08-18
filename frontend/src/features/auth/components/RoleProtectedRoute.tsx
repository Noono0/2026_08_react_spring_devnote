/**
 * ============================================================================
 * RoleProtectedRoute.tsx — 권한이 있어야 들어갈 수 있는 페이지를 지키는 문지기
 * ============================================================================
 *
 * [사용법 — App.tsx에서 이렇게 쓴다]
 *   <Route path="admin" element={
 *     <RoleProtectedRoute><AdminHomePage /></RoleProtectedRoute>
 *   } />
 *
 *   보호할 페이지를 감싸기만 하면 된다.
 *   페이지 컴포넌트 자신은 권한에 대해 아무것도 몰라도 된다.
 *   이렇게 "감싸서 기능을 더하는" 방식을 래퍼 컴포넌트라고 한다.
 *
 * [동작 흐름]
 *   로그인 상태 확인 중 → 안내 문구
 *   권한 있음          → 감싼 페이지를 그대로 보여줌
 *   권한 없음          → 홈으로 되돌려 보냄
 *
 * ★★ 다시 한번 강조: 이건 보안이 아니다.
 *   브라우저에서 실행되는 코드는 사용자가 얼마든지 조작할 수 있다.
 *   이 컴포넌트를 통과했다고 해서 데이터를 볼 수 있는 게 아니다.
 *   실제 데이터는 API로 받아 오는데, 서버가 권한을 확인하고 거부하기 때문이다.
 *
 *   이 컴포넌트의 목적은:
 *     - 권한 없는 사람에게 빈 화면이나 오류투성이 페이지를 보여주지 않는 것
 *     - "여기 들어가면 안 되는구나"를 즉시 알려 주는 것
 *   즉 보안이 아니라 사용자 경험을 위한 장치다.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";

export const RoleProtectedRoute = ({ children, superAdminOnly = false }: { children: ReactNode; superAdminOnly?: boolean }) => {
  const sessionQuery = useAuthSessionQuery();

  // ★★ 로딩 중 처리가 반드시 필요하다.
  //
  //   이게 없으면 어떤 일이 벌어지나?
  //     세션을 확인하는 동안 data는 undefined다.
  //     그러면 `allowed`가 undefined → 거짓 → 홈으로 튕겨 버린다.
  //     ★ 관리자인데도 새로고침할 때마다 홈으로 쫓겨나는 버그가 된다.
  //     "권한 없음"과 "아직 모름"을 반드시 구분해야 한다.
  if (sessionQuery.isPending) return <div className="portfolio-state-panel">로그인 상태를 확인하는 중입니다.</div>;

  // superAdminOnly에 따라 확인할 권한이 달라진다.
  //   기본           → administrator (관리자 이상)
  //   superAdminOnly → superAdministrator (최고 관리자만)
  // 문서 작성/수정처럼 더 엄격해야 하는 곳에 superAdminOnly를 쓴다.
  const allowed = superAdminOnly ? sessionQuery.data?.superAdministrator : sessionQuery.data?.administrator;

  // 통과하면 감싼 내용을 그대로 그리고, 아니면 홈으로 보낸다.
  //
  // ★ replace를 붙인 이유:
  //   방문 기록을 덮어써서 뒤로가기를 눌러도 이 주소로 돌아오지 않게 한다.
  //   안 붙이면 뒤로가기 → 또 튕김 → 무한 반복이 되어 뒤로가기가 먹통이 된다.
  //
  // ※ 더 친절하게 하려면 홈으로 보내면서
  //   "권한이 없어 이동했습니다" 같은 알림을 띄우는 방법도 있다.
  //   아무 설명 없이 홈으로 가면 사용자는 링크가 고장 났다고 생각한다.
  return allowed ? children : <Navigate to="/" replace />;
};
