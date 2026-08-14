import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";

export const RoleProtectedRoute = ({ children, superAdminOnly = false }: { children: ReactNode; superAdminOnly?: boolean }) => {
  const sessionQuery = useAuthSessionQuery();
  if (sessionQuery.isPending) return <div className="portfolio-state-panel">로그인 상태를 확인하는 중입니다.</div>;
  const allowed = superAdminOnly ? sessionQuery.data?.superAdministrator : sessionQuery.data?.administrator;
  return allowed ? children : <Navigate to="/" replace />;
};
