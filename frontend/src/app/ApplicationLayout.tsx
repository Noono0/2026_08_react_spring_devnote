/**
 * ============================================================================
 * ApplicationLayout.tsx — React 학습 영역("/react/...")의 공통 껍데기
 * ============================================================================
 *
 * [레이아웃 컴포넌트란?]
 *   여러 페이지가 공통으로 갖는 부분(사이드바, 상단바 등)을 한 곳에 모아 둔 컴포넌트다.
 *   페이지마다 사이드바를 복붙하면 나중에 메뉴 하나 고칠 때 스무 군데를 고쳐야 한다.
 *   레이아웃을 쓰면 여기 한 곳만 고치면 된다.
 *
 * [화면 구조 그림]
 *   ┌──────────────────────────────────────┐
 *   │ Sidebar │  TopBar                    │
 *   │ (메뉴)  ├────────────────────────────┤
 *   │         │  <Outlet />  ← 페이지가    │
 *   │         │              바뀌는 자리   │
 *   └──────────────────────────────────────┘
 */

import { Outlet } from "react-router-dom";
import { ApplicationSidebar } from "@/app/components/ApplicationSidebar";
import { ApplicationTopBar } from "@/app/components/ApplicationTopBar";
import { DevelopmentDebugPanel } from "@/features/development/components/DevelopmentDebugPanel";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

export const ApplicationLayout = () => {
  // 사이드바가 접혀 있는지 여부를 Zustand 스토어에서 가져온다.
  // ★ 왜 useState가 아니라 전역 스토어인가?
  //   접기 버튼은 TopBar에 있고, 실제로 접히는 건 Sidebar와 이 레이아웃이다.
  //   서로 다른 컴포넌트가 같은 값을 봐야 하므로 한 곳에 모아 둔 전역 상태를 쓴다.
  const isSidebarCollapsed = useApplicationUiStore((state) => state.isSidebarCollapsed);

  // 개발 전용 디버그 패널을 켤지 여부. `.env`의 값으로 결정된다.
  const developmentMenuEnabled =
    import.meta.env.VITE_ENABLE_DEVELOPMENT_MENU === "true";

  return (
    <div className="learning-site-shell">
      {/* 템플릿 리터럴(백틱 ``)로 CSS 클래스를 조건부로 이어 붙인다.
          접혀 있으면  → "application-shell application-shell-sidebar-collapsed"
          펼쳐져 있으면 → "application-shell"
          이렇게 클래스만 바꿔 주면 실제 너비 조절은 CSS가 알아서 한다.
          (JS로 직접 스타일을 계산하는 것보다 훨씬 간단하고 애니메이션도 쉽다) */}
      <div className={`application-shell${isSidebarCollapsed ? " application-shell-sidebar-collapsed" : ""}`}>
        <ApplicationSidebar />
        <div className="application-content-shell">
          <ApplicationTopBar />
          {/* <Outlet />: react-router가 "현재 주소에 맞는 자식 페이지"를 끼워 넣는 구멍.
              App.tsx에서 이 레이아웃의 자식으로 등록한 라우트들이 여기에 나타난다.
              주소가 바뀌면 이 부분만 갈아 끼워지고, 사이드바/상단바는 그대로 유지된다.

              <main> 태그를 쓴 이유: 화면 낭독기(스크린 리더)에게
              "여기가 이 페이지의 본문이다"라고 알려주는 시맨틱 HTML이다. */}
          <main className="application-main"><Outlet /></main>
        </div>
        {developmentMenuEnabled ? <DevelopmentDebugPanel /> : null}
      </div>
    </div>
  );
};
