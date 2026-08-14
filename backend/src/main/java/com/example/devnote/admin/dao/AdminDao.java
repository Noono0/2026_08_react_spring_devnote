package com.example.devnote.admin.dao;

import com.example.devnote.admin.dao.row.GradeRow;
import com.example.devnote.admin.dao.row.RecentVisitRow;
import com.example.devnote.admin.dao.row.RolePermissionRow;
import com.example.devnote.admin.dao.row.VisitSeriesRow;

import java.util.List;

public interface AdminDao {
    List<GradeRow> selectGrades();
    int updateGrade(String gradeCode, String gradeName, int minimumPoints, int sortOrder, String useYn);
    List<RolePermissionRow> selectRolePermissions();
    void upsertRolePermission(String memberRole, String permissionCode, String allowedYn);
    void insertVisitorEvent(String visitorKey, Long memberId, String visitedPath);
    long selectTodayVisitorCount();
    long selectMonthVisitorCount();
    List<VisitSeriesRow> selectDailyVisitSeries();
    List<VisitSeriesRow> selectMonthlyVisitSeries();
    List<RecentVisitRow> selectRecentVisits();
}
