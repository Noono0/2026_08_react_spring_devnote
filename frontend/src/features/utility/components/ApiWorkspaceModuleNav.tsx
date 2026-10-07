import { NavLink } from "react-router-dom";

// API 작업 공간의 하위 도구 이동 메뉴. end: true는 정확히 그 주소일 때만 활성 표시(하위 주소에서는 꺼짐).
const modules = [
  { to: "/utilities/api-workspace", label: "API 테스트", end: true },
  { to: "/utilities/api-workspace/openapi", label: "OpenAPI", end: false },
  { to: "/utilities/api-workspace/realtime", label: "WebSocket · SSE", end: false },
  { to: "/utilities/api-workspace/mock", label: "Mock API", end: false },
];

export const ApiWorkspaceModuleNav = () => <nav className="api-module-nav" aria-label="API Workspace 확장 기능">{modules.map((module) => <NavLink key={module.to} to={module.to} end={module.end} className={({ isActive }) => isActive ? "active" : undefined}>{module.label}</NavLink>)}</nav>;
