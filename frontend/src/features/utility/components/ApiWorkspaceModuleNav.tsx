import { NavLink } from "react-router-dom";

const modules = [
  { to: "/utilities/api-workspace", label: "API 테스트", end: true },
  { to: "/utilities/api-workspace/openapi", label: "OpenAPI", end: false },
  { to: "/utilities/api-workspace/realtime", label: "WebSocket · SSE", end: false },
  { to: "/utilities/api-workspace/mock", label: "Mock API", end: false },
];

export const ApiWorkspaceModuleNav = () => <nav className="api-module-nav" aria-label="API Workspace 확장 기능">{modules.map((module) => <NavLink key={module.to} to={module.to} end={module.end} className={({ isActive }) => isActive ? "active" : undefined}>{module.label}</NavLink>)}</nav>;
