import { Outlet } from "react-router-dom";

export const UtilityLayout = () => (
  <div className="utility-shell">
    <div className="utility-content"><Outlet /></div>
  </div>
);
