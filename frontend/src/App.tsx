/**
 * ============================================================================
 * App.tsx — "주소(URL)에 따라 어떤 화면을 보여줄지" 정하는 지도(라우팅 설정)
 * ============================================================================
 *
 * [왕초보를 위한 라우팅 개념]
 *   보통 웹사이트는 주소를 바꾸면 서버에서 새 HTML 파일을 받아 화면이 깜빡인다.
 *   React 같은 SPA(Single Page Application)는 HTML 파일이 딱 하나뿐이다.
 *   대신 "주소가 /react/todos로 바뀌면 TodoPracticePage 컴포넌트를 그려라"라는
 *   규칙을 JavaScript로 정해 둔다. 그 규칙표가 바로 이 파일이다.
 *
 * [이 파일에서 쓰는 react-router-dom 도구들]
 *   - BrowserRouter : "지금부터 주소를 감시하겠다"고 선언하는 껍데기. 앱 전체를 감싼다.
 *   - Routes        : 여러 규칙(Route) 중에서 "가장 잘 맞는 것 하나"를 골라 주는 상자.
 *   - Route         : 규칙 한 줄. path(주소)와 element(그릴 컴포넌트)를 짝지어 준다.
 *   - Navigate      : 그려지는 순간 다른 주소로 튕겨 보내는 컴포넌트. (리다이렉트)
 *   - useLocation   : 지금 주소가 무엇인지 알려주는 훅.
 *
 * [이 앱의 주소 체계 — 3덩어리로 나뉜다]
 *   1) "/"            → 포트폴리오 영역 (PortfolioLayout 껍데기 사용)
 *   2) "/react/..."   → React 학습 연습 영역 (ApplicationLayout 껍데기 사용)
 *   3) 그 외          → 옛날 주소를 새 주소로 보내 주는 리다이렉트 모음
 */

import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ApplicationProviders } from "@/app/ApplicationProviders";
import { ApplicationLayout } from "@/app/ApplicationLayout";
import { AdminUserPracticePage } from "@/features/admin/pages/AdminUserPracticePage";
import { GeneralBoardPracticePage } from "@/features/board/pages/GeneralBoardPracticePage";
import { CategoryTreePracticePage } from "@/features/category/pages/CategoryTreePracticePage";
import { CommentPracticePage } from "@/features/comment/pages/CommentPracticePage";
import { ContactPracticePage } from "@/features/contact/pages/ContactPracticePage";
import { DevelopmentScenarioPage } from "@/features/development/pages/DevelopmentScenarioPage";
import { DocumentDetailPage } from "@/features/document/pages/DocumentDetailPage";
import { DocumentEditorPage } from "@/features/document/pages/DocumentEditorPage";
import { DocumentListPage } from "@/features/document/pages/DocumentListPage";
import { GalleryPracticePage } from "@/features/gallery/pages/GalleryPracticePage";
import { InquiryPracticePage } from "@/features/inquiry/pages/InquiryPracticePage";
import { LearningRoadmapPage } from "@/features/learning/pages/LearningRoadmapPage";
import { ReactFundamentalsPage } from "@/features/learning/pages/ReactFundamentalsPage";
import { ProductModalCrudPage } from "@/features/product/pages/ProductModalCrudPage";
import { ReservationPracticePage } from "@/features/reservation/pages/ReservationPracticePage";
import { SearchAutocompletePracticePage } from "@/features/search/pages/SearchAutocompletePracticePage";
import { TaskManagementPage } from "@/features/task/pages/TaskManagementPage";
import { TodoPracticePage } from "@/features/todo/pages/TodoPracticePage";
import { PortfolioHomePage } from "@/features/portfolio/pages/PortfolioHomePage";
import { PortfolioLayout } from "@/features/portfolio/layouts/PortfolioLayout";
import { VisitTracker } from "@/app/components/VisitTracker";
import { LearningLevelPage } from "@/features/learning/pages/LearningLevelPage";
import { UtilityHomePage } from "@/features/utility/pages/UtilityHomePage";
import { DeveloperToolsPage } from "@/features/utility/pages/DeveloperToolsPage";
import { PollPage } from "@/features/utility/pages/PollPage";
import { UtilityLayout } from "@/features/utility/layouts/UtilityLayout";
import { AdminHomePage } from "@/features/admin/pages/AdminHomePage";
import { MemberManagementPage } from "@/features/admin/pages/MemberManagementPage";
import { GradeManagementPage } from "@/features/admin/pages/GradeManagementPage";
import { PermissionManagementPage } from "@/features/admin/pages/PermissionManagementPage";
import { VisitAnalyticsPage } from "@/features/admin/pages/VisitAnalyticsPage";
import { RoleProtectedRoute } from "@/features/auth/components/RoleProtectedRoute";

// ----------------------------------------------------------------------------
// 1. 환경변수로 켜고 끄는 개발 전용 메뉴
// ----------------------------------------------------------------------------
// `.env` 파일의 VITE_ENABLE_DEVELOPMENT_MENU 값을 읽는다.
// 환경변수는 항상 "문자열"로 들어오기 때문에 boolean true가 아니라 문자열 "true"와 비교한다.
// (VITE_ 로 시작하는 이름만 브라우저 코드에서 읽을 수 있다. Vite의 보안 규칙이다.)
const developmentScenarioEnabled = import.meta.env.VITE_ENABLE_DEVELOPMENT_MENU === "true";

// ----------------------------------------------------------------------------
// 2. 코드 스플리팅(Code Splitting) — 무거운 페이지는 "필요할 때" 내려받기
// ----------------------------------------------------------------------------
// 위쪽 import들은 앱이 켜질 때 전부 한꺼번에 다운로드된다.
// 반면 `lazy(...)`로 감싼 페이지는 사용자가 그 주소로 실제 들어갔을 때 비로소 다운로드된다.
//
// 왜 이렇게 하나?
//   아래 유틸리티 페이지들(JWT 디코더, SQL ERD 등)은 무거운 라이브러리를 쓴다.
//   이걸 전부 처음부터 받으면 첫 화면이 뜨는 데 한참 걸린다.
//   그래서 "잘 안 들어가는 무거운 페이지"만 따로 떼어 두는 것이다.
//
// 규칙: lazy는 반드시 `default` 키를 가진 객체를 돌려줘야 한다.
//       이 프로젝트는 `export const XxxPage` (named export) 방식이라
//       아래처럼 직접 `{ default: ... }` 모양으로 바꿔서 넘겨 준다.
const ApiWorkspacePage = lazy(async () => {
  const pageModule = await import("@/features/utility/pages/ApiWorkspacePage");
  return { default: pageModule.ApiWorkspacePage };
});
const JsonCsvConverterPage = lazy(async () => {
  const pageModule = await import("@/features/utility/pages/JsonCsvConverterPage");
  return { default: pageModule.JsonCsvConverterPage };
});
// 아래부터는 위 두 개와 똑같은 일을 한 줄로 압축해서 쓴 것이다.
// `(await import("경로")).ExportName` → 파일을 받아온 뒤 그 안의 이름 하나를 꺼낸다.
const CodeFormatterPage = lazy(async () => ({ default: (await import("@/features/utility/pages/CodeFormatterPage")).CodeFormatterPage }));
const RegexTesterPage = lazy(async () => ({ default: (await import("@/features/utility/pages/RegexTesterPage")).RegexTesterPage }));
const DataConverterPage = lazy(async () => ({ default: (await import("@/features/utility/pages/DataConverterPage")).DataConverterPage }));
const CodeDiffPage = lazy(async () => ({ default: (await import("@/features/utility/pages/CodeDiffPage")).CodeDiffPage }));
const JwtDecoderPage = lazy(async () => ({ default: (await import("@/features/utility/pages/JwtDecoderPage")).JwtDecoderPage }));
const MarkdownEditorPage = lazy(async () => ({ default: (await import("@/features/utility/pages/MarkdownEditorPage")).MarkdownEditorPage }));
const TestDataGeneratorPage = lazy(async () => ({ default: (await import("@/features/utility/pages/TestDataGeneratorPage")).TestDataGeneratorPage }));
const CronGeneratorPage = lazy(async () => ({ default: (await import("@/features/utility/pages/CronGeneratorPage")).CronGeneratorPage }));
const DeveloperSnippetPage = lazy(async () => ({ default: (await import("@/features/utility/pages/DeveloperSnippetPage")).DeveloperSnippetPage }));
const OpenApiStudioPage = lazy(async () => ({ default: (await import("@/features/utility/pages/OpenApiStudioPage")).OpenApiStudioPage }));
const RealtimeTesterPage = lazy(async () => ({ default: (await import("@/features/utility/pages/RealtimeTesterPage")).RealtimeTesterPage }));
const MockApiScenarioPage = lazy(async () => ({ default: (await import("@/features/utility/pages/MockApiScenarioPage")).MockApiScenarioPage }));
const JsonPathExplorerPage = lazy(async () => ({ default: (await import("@/features/utility/pages/JsonPathExplorerPage")).JsonPathExplorerPage }));
const SqlSchemaErdPage = lazy(async () => ({ default: (await import("@/features/utility/pages/SqlSchemaErdPage")).SqlSchemaErdPage }));
const LogAnalyzerPage = lazy(async () => ({ default: (await import("@/features/utility/pages/LogAnalyzerPage")).LogAnalyzerPage }));
const CorsHeaderInspectorPage = lazy(async () => ({ default: (await import("@/features/utility/pages/CorsHeaderInspectorPage")).CorsHeaderInspectorPage }));
// 다이어그램 화면은 React Flow를 포함해 무겁다.
// lazy로 분리해 다이어그램을 쓰지 않는 사용자는 내려받지 않게 한다.
const DiagramListPage = lazy(async () => ({ default: (await import("@/features/diagram/pages/DiagramListPage")).DiagramListPage }));
const DiagramEditorPage = lazy(async () => ({ default: (await import("@/features/diagram/pages/DiagramEditorPage")).DiagramEditorPage }));
const DependencyAnalyzerPage = lazy(async () => ({ default: (await import("@/features/utility/pages/DependencyAnalyzerPage")).DependencyAnalyzerPage }));

// ----------------------------------------------------------------------------
// 3. lazy 페이지를 기다리는 동안 보여줄 임시 화면
// ----------------------------------------------------------------------------
// lazy 페이지는 다운로드되는 동안 잠깐 "아직 없는" 상태가 된다.
// 그 빈 시간을 채우는 게 <Suspense fallback={...}> 이고, 여기에 넣을 내용이 이 컴포넌트다.
//
// `{ name }: { name: string }` 부분은 props 구조 분해 + 타입 지정을 한 번에 한 것이다.
// 풀어 쓰면: (props: { name: string }) => ... 에서 props.name 을 바로 꺼내 쓴 것.
const UtilityLazyFallback = ({ name }: { name: string }) => <div className="portfolio-state-panel">{name}를 불러오는 중입니다.</div>;

/**
 * 옛날 주소를 새 주소로 옮겨 주는 컴포넌트.
 *
 * 예전에는 문서 목록 주소가 `/documents` 였는데 지금은 `/react/documents`로 바뀌었다.
 * 누가 옛 주소를 북마크해 뒀을 수 있으니, 앞에 `/react`만 붙여서 그대로 보내 준다.
 *
 *   location.pathname → "/documents/3"     (주소의 경로 부분)
 *   location.search   → "?page=2"          (물음표 뒤 쿼리스트링)
 *   location.hash     → "#comments"        (샵 뒤 해시)
 *
 * `replace`를 붙이면 브라우저 방문 기록을 "덮어쓴다".
 * 이게 없으면 뒤로가기를 눌렀을 때 옛 주소로 돌아가고, 그럼 또 새 주소로 튕기고…
 * 무한 반복에 빠져서 뒤로가기가 먹통이 된다.
 */
const LegacyDocumentRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/react${location.pathname}${location.search}${location.hash}`} replace />;
};

// ----------------------------------------------------------------------------
// 4. 앱의 최상위 컴포넌트
// ----------------------------------------------------------------------------
// 화살표 함수 뒤에 중괄호 `{}` 없이 소괄호 `(...)`만 있으면 "이 JSX를 바로 return 한다"는 뜻이다.
// 즉 `=> ( ... )` 는 `=> { return ( ... ); }` 와 같다.
//
// 감싸는 순서에 의미가 있다:
//   ApplicationProviders (데이터/테마 등 공용 도구 제공)
//     └ BrowserRouter    (주소 감시 시작)
//         └ Routes       (규칙 중 하나 선택)
export const App = () => (
  <ApplicationProviders>
    <BrowserRouter>
      {/* 화면에 아무것도 그리지 않고, 주소가 바뀔 때마다 방문 기록만 서버에 남기는 컴포넌트.
          이렇게 "화면 없이 동작만 하는 컴포넌트"도 React에서는 흔한 패턴이다. */}
      <VisitTracker />
      <Routes>
        {/* ── 영역 1: 포트폴리오 (주소 앞에 아무 접두사가 없는 "/" 계열) ──────────
            path 없이 element만 있는 Route = "레이아웃 라우트".
            주소를 하나 차지하지 않고, 자식 라우트들을 공통 껍데기로 감싸기만 한다.
            PortfolioLayout 안의 <Outlet />(구멍) 자리에 아래 자식 화면들이 끼워진다. */}
        <Route element={<PortfolioLayout />}>
          {/* index = "부모 주소 그 자체". 여기서는 "/" 에 해당한다. */}
          <Route index element={<PortfolioHomePage />} />
          <Route path="history" element={<DocumentListPage />} />
          {/* RoleProtectedRoute로 감싸면 "권한 있는 사람만 통과" 시키는 문지기가 붙는다.
              글쓰기/수정처럼 아무나 하면 안 되는 화면에 사용한다. */}
          <Route path="history/new" element={<RoleProtectedRoute superAdminOnly><DocumentEditorPage /></RoleProtectedRoute>} />
          {/* `:documentId` 처럼 콜론이 붙으면 "여기는 값이 바뀌는 자리"라는 뜻이다.
              /history/7 로 들어오면 documentId = "7" 이 되고,
              화면 쪽에서는 useParams()로 그 값을 꺼내 쓴다. (항상 문자열로 들어온다!) */}
          <Route path="history/:documentId" element={<DocumentDetailPage />} />
          <Route path="history/:documentId/edit" element={<RoleProtectedRoute superAdminOnly><DocumentEditorPage /></RoleProtectedRoute>} />
          {/* 레이아웃 라우트는 이렇게 중첩(nested)해서 여러 겹으로 쌓을 수도 있다.
              최종 주소는 부모 path들이 이어 붙은 결과다: "/" + "utilities" + "regex" */}
          <Route path="utilities" element={<UtilityLayout />}>
            <Route index element={<UtilityHomePage />} />
            {/* lazy로 만든 페이지는 반드시 <Suspense>로 감싸야 한다.
                감싸지 않으면 "다운로드 중" 상태에서 React가 에러를 던진다.
                fallback = 다운로드가 끝날 때까지 대신 보여줄 화면. */}
            <Route path="api-workspace" element={<Suspense fallback={<div className="portfolio-state-panel">API Workspace를 불러오는 중입니다.</div>}><ApiWorkspacePage /></Suspense>} />
            <Route path="api-workspace/openapi" element={<Suspense fallback={<UtilityLazyFallback name="OpenAPI Studio" />}><OpenApiStudioPage /></Suspense>} />
            <Route path="api-workspace/realtime" element={<Suspense fallback={<UtilityLazyFallback name="WebSocket · SSE Tester" />}><RealtimeTesterPage /></Suspense>} />
            <Route path="api-workspace/mock" element={<Suspense fallback={<UtilityLazyFallback name="Mock API Scenario Builder" />}><MockApiScenarioPage /></Suspense>} />
            <Route path="json-csv" element={<Suspense fallback={<div className="portfolio-state-panel">JSON CSV Converter를 불러오는 중입니다.</div>}><JsonCsvConverterPage /></Suspense>} />
            <Route path="regex" element={<Suspense fallback={<UtilityLazyFallback name="Regex Tester" />}><RegexTesterPage /></Suspense>} />
            <Route path="formatter" element={<Suspense fallback={<UtilityLazyFallback name="Code Formatter" />}><CodeFormatterPage /></Suspense>} />
            <Route path="converter" element={<Suspense fallback={<UtilityLazyFallback name="Data Converter" />}><DataConverterPage /></Suspense>} />
            <Route path="diff" element={<Suspense fallback={<UtilityLazyFallback name="Code Diff" />}><CodeDiffPage /></Suspense>} />
            <Route path="jwt" element={<Suspense fallback={<UtilityLazyFallback name="JWT Decoder" />}><JwtDecoderPage /></Suspense>} />
            <Route path="markdown" element={<Suspense fallback={<UtilityLazyFallback name="Markdown Editor" />}><MarkdownEditorPage /></Suspense>} />
            <Route path="test-data" element={<Suspense fallback={<UtilityLazyFallback name="Test Data Generator" />}><TestDataGeneratorPage /></Suspense>} />
            <Route path="cron" element={<Suspense fallback={<UtilityLazyFallback name="Cron Generator" />}><CronGeneratorPage /></Suspense>} />
            <Route path="snippets" element={<Suspense fallback={<UtilityLazyFallback name="Developer Snippet" />}><DeveloperSnippetPage /></Suspense>} />
            <Route path="tools" element={<DeveloperToolsPage />} />
            <Route path="polls" element={<PollPage />} />
            <Route path="jsonpath" element={<Suspense fallback={<UtilityLazyFallback name="JSONPath Explorer" />}><JsonPathExplorerPage /></Suspense>} />
            <Route path="sql-erd" element={<Suspense fallback={<UtilityLazyFallback name="SQL Schema ERD" />}><SqlSchemaErdPage /></Suspense>} />
            <Route path="log-analyzer" element={<Suspense fallback={<UtilityLazyFallback name="Log Analyzer" />}><LogAnalyzerPage /></Suspense>} />
            <Route path="cors-inspector" element={<Suspense fallback={<UtilityLazyFallback name="CORS Inspector" />}><CorsHeaderInspectorPage /></Suspense>} />
            <Route path="diagrams" element={<Suspense fallback={<UtilityLazyFallback name="Diagram Designer" />}><DiagramListPage /></Suspense>} />
            <Route path="diagrams/:diagramId" element={<Suspense fallback={<UtilityLazyFallback name="Diagram Designer" />}><DiagramEditorPage /></Suspense>} />
            <Route path="dependencies" element={<Suspense fallback={<UtilityLazyFallback name="Dependency Analyzer" />}><DependencyAnalyzerPage /></Suspense>} />
          </Route>
          {/* 관리자 화면 묶음. 전부 RoleProtectedRoute로 감싸서 비관리자는 못 들어간다. */}
          <Route path="admin" element={<RoleProtectedRoute><AdminHomePage /></RoleProtectedRoute>} />
          <Route path="admin/members" element={<RoleProtectedRoute><MemberManagementPage /></RoleProtectedRoute>} />
          <Route path="admin/grades" element={<RoleProtectedRoute><GradeManagementPage /></RoleProtectedRoute>} />
          <Route path="admin/permissions" element={<RoleProtectedRoute><PermissionManagementPage /></RoleProtectedRoute>} />
          <Route path="admin/analytics" element={<RoleProtectedRoute><VisitAnalyticsPage /></RoleProtectedRoute>} />
        </Route>
        {/* ── 영역 2: React 학습 연습장 ("/react" 로 시작하는 모든 주소) ──────────
            이쪽은 ApplicationLayout(사이드바 + 상단바가 있는 학습용 껍데기)을 쓴다.
            난이도 순서대로 아래에 나열되어 있다: 왕초보 → 초급 → 중급 → 고급 */}
        <Route path="/react" element={<ApplicationLayout />}>
          <Route index element={<LearningRoadmapPage />} />
          <Route path="level/:level" element={<LearningLevelPage />} />
          {/* 왕초보: React의 기본 문법 (useState, props, 이벤트) */}
          <Route path="fundamentals" element={<ReactFundamentalsPage />} />
          {/* 초급: 서버 없이 배열 State만으로 하는 CRUD 연습 */}
          <Route path="todos" element={<TodoPracticePage />} />
          <Route path="contacts" element={<ContactPracticePage />} />
          <Route path="modal-products" element={<ProductModalCrudPage />} />
          <Route path="search-autocomplete" element={<SearchAutocompletePracticePage />} />
          <Route path="general-board" element={<GeneralBoardPracticePage />} />
          <Route path="gallery" element={<GalleryPracticePage />} />
          <Route path="comments" element={<CommentPracticePage />} />
          <Route path="reservations" element={<ReservationPracticePage />} />
          {/* 중급: 비동기 처리 + 로딩/오류 상태 다루기 */}
          <Route path="tasks" element={<TaskManagementPage />} />
          <Route path="inquiries" element={<InquiryPracticePage />} />
          <Route path="categories" element={<CategoryTreePracticePage />} />
          {/* 고급: 진짜 백엔드 API와 TanStack Query를 쓰는 문서 CRUD */}
          <Route path="documents" element={<DocumentListPage />} />
          <Route path="documents/new" element={<DocumentEditorPage />} />
          <Route path="documents/:documentId" element={<DocumentDetailPage />} />
          <Route path="documents/:documentId/edit" element={<DocumentEditorPage />} />
          <Route path="admin-users" element={<AdminUserPracticePage />} />
          {/* 삼항 연산자(조건 ? A : B)로 라우트를 켜고 끈다.
              개발 메뉴가 꺼져 있으면 페이지 대신 "/react"로 되돌려 보낸다. */}
          <Route path="development/scenarios" element={developmentScenarioEnabled ? <DevelopmentScenarioPage /> : <Navigate to="/react" replace />} />
        </Route>

        {/* ── 영역 3: 옛 주소 → 새 주소 리다이렉트 모음 ─────────────────────────
            주소 체계를 바꾸면 기존 링크나 북마크가 전부 깨진다.
            그래서 옛 주소도 살려 두고 새 주소로 넘겨 주는 것이 실무 관례다. */}
        <Route path="/learning-roadmap" element={<Navigate to="/react" replace />} />
        <Route path="/practice/fundamentals" element={<Navigate to="/react/fundamentals" replace />} />
        <Route path="/practice/todos" element={<Navigate to="/react/todos" replace />} />
        <Route path="/practice/contacts" element={<Navigate to="/react/contacts" replace />} />
        <Route path="/practice/modal-products" element={<Navigate to="/react/modal-products" replace />} />
        <Route path="/practice/search-autocomplete" element={<Navigate to="/react/search-autocomplete" replace />} />
        <Route path="/practice/general-board" element={<Navigate to="/react/general-board" replace />} />
        <Route path="/practice/gallery" element={<Navigate to="/react/gallery" replace />} />
        <Route path="/practice/comments" element={<Navigate to="/react/comments" replace />} />
        <Route path="/practice/reservations" element={<Navigate to="/react/reservations" replace />} />
        <Route path="/tasks" element={<Navigate to="/react/tasks" replace />} />
        <Route path="/practice/inquiries" element={<Navigate to="/react/inquiries" replace />} />
        <Route path="/practice/categories" element={<Navigate to="/react/categories" replace />} />
        {/* `*`(와일드카드)는 "그 아래 모든 주소"를 뜻한다.
            /documents, /documents/3, /documents/3/edit 이 전부 여기로 걸린다. */}
        <Route path="/documents/*" element={<LegacyDocumentRedirect />} />
        <Route path="/practice/admin-users" element={<Navigate to="/react/admin-users" replace />} />
        <Route path="/development/scenarios" element={<Navigate to="/react/development/scenarios" replace />} />
        {/* 위의 어떤 규칙에도 안 걸린 주소 = 존재하지 않는 페이지(404).
            반드시 맨 마지막에 둬야 한다. 위에 두면 모든 주소를 다 잡아먹는다. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </ApplicationProviders>
);
