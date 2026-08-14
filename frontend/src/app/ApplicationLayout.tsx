import { Outlet } from "react-router-dom";
import { ApplicationSidebar } from "@/app/components/ApplicationSidebar";
import { ApplicationTopBar } from "@/app/components/ApplicationTopBar";
import { DevelopmentDebugPanel } from "@/features/development/components/DevelopmentDebugPanel";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

export const ApplicationLayout = () => {
  const isSidebarCollapsed = useApplicationUiStore((state) => state.isSidebarCollapsed);
  const developmentMenuEnabled =
    import.meta.env.VITE_ENABLE_DEVELOPMENT_MENU === "true";

  return (
    <div className="learning-site-shell">
      <div className={`application-shell${isSidebarCollapsed ? " application-shell-sidebar-collapsed" : ""}`}>
        <ApplicationSidebar />
        <div className="application-content-shell">
          <ApplicationTopBar />
          <main className="application-main"><Outlet /></main>
        </div>
        {developmentMenuEnabled ? <DevelopmentDebugPanel /> : null}
      </div>
    </div>
  );
};
