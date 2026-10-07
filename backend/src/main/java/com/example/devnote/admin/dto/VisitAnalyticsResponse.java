package com.example.devnote.admin.dto;

import java.util.List;

/** 방문 통계 화면에 필요한 값을 한 번에 담은 응답(요청 한 번으로 화면 전체를 그린다). */
public record VisitAnalyticsResponse(long todayVisitors, long monthVisitors, List<VisitSeriesItem> daily, List<VisitSeriesItem> monthly, List<RecentVisitResponse> recentVisits) {
}
