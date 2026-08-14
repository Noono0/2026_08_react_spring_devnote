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

const developmentScenarioEnabled = import.meta.env.VITE_ENABLE_DEVELOPMENT_MENU === "true";
const ApiWorkspacePage = lazy(async () => {
  const pageModule = await import("@/features/utility/pages/ApiWorkspacePage");
  return { default: pageModule.ApiWorkspacePage };
});
const JsonCsvConverterPage = lazy(async () => {
  const pageModule = await import("@/features/utility/pages/JsonCsvConverterPage");
  return { default: pageModule.JsonCsvConverterPage };
});
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
const DependencyAnalyzerPage = lazy(async () => ({ default: (await import("@/features/utility/pages/DependencyAnalyzerPage")).DependencyAnalyzerPage }));

const UtilityLazyFallback = ({ name }: { name: string }) => <div className="portfolio-state-panel">{name}를 불러오는 중입니다.</div>;

const LegacyDocumentRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/react${location.pathname}${location.search}${location.hash}`} replace />;
};

export const App = () => (
  <ApplicationProviders>
    <BrowserRouter>
      <VisitTracker />
      <Routes>
        <Route element={<PortfolioLayout />}>
          <Route index element={<PortfolioHomePage />} />
          <Route path="history" element={<DocumentListPage />} />
          <Route path="history/new" element={<RoleProtectedRoute superAdminOnly><DocumentEditorPage /></RoleProtectedRoute>} />
          <Route path="history/:documentId" element={<DocumentDetailPage />} />
          <Route path="history/:documentId/edit" element={<RoleProtectedRoute superAdminOnly><DocumentEditorPage /></RoleProtectedRoute>} />
          <Route path="utilities" element={<UtilityLayout />}>
            <Route index element={<UtilityHomePage />} />
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
            <Route path="dependencies" element={<Suspense fallback={<UtilityLazyFallback name="Dependency Analyzer" />}><DependencyAnalyzerPage /></Suspense>} />
          </Route>
          <Route path="admin" element={<RoleProtectedRoute><AdminHomePage /></RoleProtectedRoute>} />
          <Route path="admin/members" element={<RoleProtectedRoute><MemberManagementPage /></RoleProtectedRoute>} />
          <Route path="admin/grades" element={<RoleProtectedRoute><GradeManagementPage /></RoleProtectedRoute>} />
          <Route path="admin/permissions" element={<RoleProtectedRoute><PermissionManagementPage /></RoleProtectedRoute>} />
          <Route path="admin/analytics" element={<RoleProtectedRoute><VisitAnalyticsPage /></RoleProtectedRoute>} />
        </Route>
        <Route path="/react" element={<ApplicationLayout />}>
          <Route index element={<LearningRoadmapPage />} />
          <Route path="level/:level" element={<LearningLevelPage />} />
          <Route path="fundamentals" element={<ReactFundamentalsPage />} />
          <Route path="todos" element={<TodoPracticePage />} />
          <Route path="contacts" element={<ContactPracticePage />} />
          <Route path="modal-products" element={<ProductModalCrudPage />} />
          <Route path="search-autocomplete" element={<SearchAutocompletePracticePage />} />
          <Route path="general-board" element={<GeneralBoardPracticePage />} />
          <Route path="gallery" element={<GalleryPracticePage />} />
          <Route path="comments" element={<CommentPracticePage />} />
          <Route path="reservations" element={<ReservationPracticePage />} />
          <Route path="tasks" element={<TaskManagementPage />} />
          <Route path="inquiries" element={<InquiryPracticePage />} />
          <Route path="categories" element={<CategoryTreePracticePage />} />
          <Route path="documents" element={<DocumentListPage />} />
          <Route path="documents/new" element={<DocumentEditorPage />} />
          <Route path="documents/:documentId" element={<DocumentDetailPage />} />
          <Route path="documents/:documentId/edit" element={<DocumentEditorPage />} />
          <Route path="admin-users" element={<AdminUserPracticePage />} />
          <Route path="development/scenarios" element={developmentScenarioEnabled ? <DevelopmentScenarioPage /> : <Navigate to="/react" replace />} />
        </Route>
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
        <Route path="/documents/*" element={<LegacyDocumentRedirect />} />
        <Route path="/practice/admin-users" element={<Navigate to="/react/admin-users" replace />} />
        <Route path="/development/scenarios" element={<Navigate to="/react/development/scenarios" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </ApplicationProviders>
);
