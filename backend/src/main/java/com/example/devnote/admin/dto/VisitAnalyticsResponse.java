package com.example.devnote.admin.dto;

import java.util.List;

public record VisitAnalyticsResponse(long todayVisitors, long monthVisitors, List<VisitSeriesItem> daily, List<VisitSeriesItem> monthly, List<RecentVisitResponse> recentVisits) {
}
