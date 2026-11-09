import { useState } from "react";
import { Link } from "react-router-dom";
import { ClientSideRowModelModule, LocaleModule, PaginationModule, QuickFilterModule, RowApiModule, TextFilterModule, themeQuartz,
  type ColDef, type GridApi, type ICellRendererParams, type ValueFormatterParams } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { useAdminMembersQuery } from "@/features/admin/hooks/useAdminQueries";
import type { AdminMember } from "@/features/admin/types/adminTypes";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";
import { GridAnalysisPanel } from "@/shared/grid/GridAnalysisPanel";
import type { GridAnalysisField } from "@/shared/grid/gridAnalysis";

const columns: ColDef<AdminMember>[] = [
  { field: "memberName", headerName: "회원", minWidth: 150, flex: 1,
    cellRenderer: ({ data }: ICellRendererParams<AdminMember>) => data ? <Link to={`/admin/members/${data.memberId}`}>{data.memberName}</Link> : null },
  { field: "loginId", headerName: "아이디", minWidth: 145, valueFormatter: ({ value }: ValueFormatterParams<AdminMember, string | null>) => value ?? "로그인 ID 없음" },
  { field: "email", headerName: "이메일", minWidth: 220, flex: 1 },
  { field: "gradeCode", headerName: "등급", minWidth: 115 },
  { field: "memberRole", headerName: "역할", minWidth: 145 },
  { field: "accountStatus", headerName: "상태", minWidth: 130 },
  { field: "lastLoginAt", headerName: "최근 로그인", minWidth: 170,
    valueFormatter: ({ value }: ValueFormatterParams<AdminMember, string | null>) => value ? value.slice(0, 16).replace("T", " ") : "기록 없음" },
];
const defaultColumn: ColDef<AdminMember> = { sortable: true, filter: true, resizable: true };
// 필요한 Community 모듈만 등록해 이 화면의 다운로드 크기를 줄인다.
const gridModules = [ClientSideRowModelModule, LocaleModule, PaginationModule, QuickFilterModule, RowApiModule, TextFilterModule];
const analysisFields: GridAnalysisField<AdminMember>[] = [
  { key: "memberRole", label: "역할", kind: "dimension", value: (member) => member.memberRole },
  { key: "gradeCode", label: "등급", kind: "dimension", value: (member) => member.gradeCode },
  { key: "accountStatus", label: "계정 상태", kind: "dimension", value: (member) => member.accountStatus },
];
const localeText = {
  page: "페이지", of: "/", to: "~", more: "더 보기", next: "다음", last: "마지막", first: "처음", previous: "이전",
  firstPage: "첫 페이지", previousPage: "이전 페이지", nextPage: "다음 페이지", lastPage: "마지막 페이지",
  pageSizeSelectorLabel: "페이지당 행", ariaPageSizeSelectorLabel: "페이지당 행", noRowsToShow: "표시할 회원이 없습니다.", loadingOoo: "불러오는 중...",
  searchOoo: "검색...", filterOoo: "필터...", selectAll: "모두 선택", blanks: "빈 값",
  equals: "같음", notEqual: "다름", contains: "포함", notContains: "포함하지 않음", startsWith: "시작", endsWith: "끝",
  lessThan: "미만", greaterThan: "초과", inRange: "범위", applyFilter: "적용", resetFilter: "초기화", clearFilter: "지우기",
};
const gridTheme = themeQuartz.withParams({ backgroundColor: "var(--background-panel)", foregroundColor: "var(--text-primary)",
  headerBackgroundColor: "var(--background-muted)", borderColor: "var(--border-color)", accentColor: "var(--primary-color)" });

export const MemberManagementPage = () => {
  const membersQuery = useAdminMembersQuery();
  const [keyword, setKeyword] = useState("");
  const [visibleMembers, setVisibleMembers] = useState<AdminMember[] | null>(null);
  const updateVisibleMembers = (api: GridApi<AdminMember>) => {
    const next: AdminMember[] = [];
    for (let index = 0; index < api.getDisplayedRowCount(); index++) {
      const member = api.getDisplayedRowAtIndex(index)?.data;
      if (member) next.push(member);
    }
    setVisibleMembers((current) => current && current.length === next.length && current.every((member, index) => member === next[index]) ? current : next);
  };

  if (membersQuery.isPending) return <div className="portfolio-state-panel">회원을 불러오는 중입니다.</div>;
  if (membersQuery.isError) return <div className="portfolio-state-panel error-state" role="alert">회원 목록을 불러오지 못했습니다.</div>;

  return <section className="site-page"><div className="page-hero"><span className="page-kicker">Member Management</span><div className="page-title-with-guide"><h1>회원관리</h1><FeatureHelpButton topic="members" /></div><p>회원 이름을 누르면 상세정보와 수정 화면이 열립니다.</p></div>
    <label className="admin-search">회원 검색<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="아이디, 이름, 이메일" /></label>
    <p className="member-list-count">전체 회원 {membersQuery.data.length}명 · 현재 표시 {(visibleMembers ?? membersQuery.data).length}명</p>
    <div className="member-grid-wrap" role="region" aria-label="회원 목록 그리드">
      <AgGridProvider modules={gridModules}>
        <AgGridReact<AdminMember> rowData={membersQuery.data} columnDefs={columns} defaultColDef={defaultColumn} getRowId={({ data }) => String(data.memberId)}
          theme={gridTheme} localeText={localeText} quickFilterText={keyword} pagination paginationPageSize={10} paginationPageSizeSelector={[10, 25, 50]}
          onModelUpdated={(event) => updateVisibleMembers(event.api)}
          onFirstDataRendered={(event) => updateVisibleMembers(event.api)}
          onFilterChanged={(event) => updateVisibleMembers(event.api)} />
      </AgGridProvider>
    </div>
    <GridAnalysisPanel rows={visibleMembers ?? membersQuery.data} fields={analysisFields} />
  </section>;
};
