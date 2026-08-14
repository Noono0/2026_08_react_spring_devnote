import { useLocation } from "react-router-dom";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";
import { LearningGuideButton } from "@/features/learning/components/LearningGuideButton";
import { findLearningGuideByPathname } from "@/features/learning/data/learningGuides";

const getCurrentPageTitle = (pathname: string): string => {
  const learningPathname = pathname.startsWith("/react") ? pathname.slice("/react".length) || "/" : pathname;
  if (learningPathname === "/") return "학습 로드맵";
  if (learningPathname.startsWith("/fundamentals")) return "React 기초 실습";
  if (learningPathname.startsWith("/todos")) return "할 일 인라인 CRUD";
  if (learningPathname.startsWith("/contacts")) return "연락처 Reducer CRUD";
  if (learningPathname.startsWith("/modal-products")) return "상품 모달 CRUD";
  if (learningPathname.startsWith("/search-autocomplete")) return "실시간 검색 자동완성";
  if (learningPathname.startsWith("/general-board")) return "일반 페이지형 게시판";
  if (learningPathname.startsWith("/gallery")) return "이미지 갤러리 CRUD";
  if (learningPathname.startsWith("/comments")) return "댓글·대댓글 CRUD";
  if (learningPathname.startsWith("/reservations")) return "예약 관리 CRUD";
  if (learningPathname.startsWith("/tasks")) return "업무·칸반 API CRUD";
  if (learningPathname.startsWith("/inquiries")) return "문의·답변 권한 CRUD";
  if (learningPathname.startsWith("/categories")) return "카테고리 트리 CRUD";
  if (learningPathname.startsWith("/admin-users")) return "관리자 사용자 CRUD";
  if (learningPathname.startsWith("/documents/new")) return "고급 문서 작성";
  if (learningPathname.includes("/edit")) return "고급 문서 수정";
  if (learningPathname.startsWith("/documents")) return "문서 에디터·이미지 CRUD";
  if (learningPathname.startsWith("/development")) return "개발 오류 시나리오";
  return "DevNote Practice";
};

export const ApplicationTopBar = () => {
  const location = useLocation();
  const learningGuide = findLearningGuideByPathname(location.pathname);
  const {
    applicationTheme,
    toggleApplicationTheme,
    openMobileSidebar,
  } = useApplicationUiStore();

  return (
    <header className="application-top-bar">
      <div className="top-bar-title-row">
        <button
          className="top-bar-icon-button mobile-menu-button"
          type="button"
          onClick={openMobileSidebar}
          aria-label="사이드바 메뉴 열기"
        >
          ☰
        </button>
        <div>
          <span className="top-bar-eyebrow">React Beginner to Advanced</span>
          <strong className="top-bar-title">{getCurrentPageTitle(location.pathname)}</strong>
        </div>
      </div>

      <div className="top-bar-actions">
        {learningGuide ? <LearningGuideButton learningGuide={learningGuide} /> : null}
        <span className="top-bar-mode-description">
          {applicationTheme === "dark" ? "다크 모드" : "라이트 모드"}
        </span>
        <button
          className="top-bar-icon-button"
          type="button"
          onClick={toggleApplicationTheme}
          aria-label={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}
          title={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}
        >
          {applicationTheme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
};
