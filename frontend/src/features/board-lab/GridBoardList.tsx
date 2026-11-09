import { Link } from "react-router-dom";
import { ClientSideRowModelModule, LocaleModule, TextFilterModule, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import type { BoardPostSummary } from "./boardApi";

const columns: ColDef<BoardPostSummary>[] = [
  { field: "title", headerName: "제목", minWidth: 240, flex: 2,
    cellRenderer: ({ data }: ICellRendererParams<BoardPostSummary>) => data ? <Link to={`/react/boards/grid/${data.postId}`}>{data.title}</Link> : null },
  { field: "authorName", headerName: "작성자", minWidth: 120, flex: 1 },
  { field: "createdAt", headerName: "작성일", minWidth: 170,
    valueFormatter: ({ value }) => typeof value === "string" ? value.slice(0, 16).replace("T", " ") : "" },
  { field: "viewCount", headerName: "조회", minWidth: 95 },
];
const gridModules = [ClientSideRowModelModule, LocaleModule, TextFilterModule];
const gridTheme = themeQuartz.withParams({ backgroundColor: "var(--background-panel)", foregroundColor: "var(--text-primary)",
  headerBackgroundColor: "var(--background-muted)", borderColor: "var(--border-color)", accentColor: "var(--primary-color)" });

/** 서버 검색과 페이지 이동은 전체 글에 적용되고, 열 정렬·필터는 현재 불러온 50건에 적용된다. */
export function GridBoardList({ posts }: { posts: BoardPostSummary[] }) {
  return <div className="board-lab-grid" role="region" aria-label="게시글 그리드" tabIndex={0}>
    <AgGridProvider modules={gridModules}>
      <AgGridReact<BoardPostSummary> rowData={posts} columnDefs={columns} defaultColDef={{ sortable: true, filter: true, resizable: true }}
        getRowId={({ data }) => String(data.postId)} theme={gridTheme} domLayout="autoHeight"
        localeText={{ noRowsToShow: "표시할 글이 없습니다.", contains: "포함", notContains: "포함하지 않음", equals: "같음", notEqual: "다름",
          startsWith: "시작", endsWith: "끝", filterOoo: "필터...", applyFilter: "적용", resetFilter: "초기화" }} />
    </AgGridProvider>
  </div>;
}
