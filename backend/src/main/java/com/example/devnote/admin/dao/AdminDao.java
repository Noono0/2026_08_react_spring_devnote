package com.example.devnote.admin.dao;

import com.example.devnote.admin.dao.row.GradeRow;
import com.example.devnote.admin.dao.row.RecentVisitRow;
import com.example.devnote.admin.dao.row.RolePermissionRow;
import com.example.devnote.admin.dao.row.VisitSeriesRow;

import java.util.List;

/**
 * 관리자 기능용 테이블(member_grades, permissions, role_permissions, visitor_events) 접근 약속.
 * 회원 자체(members)는 MemberDao가 담당한다.
 */
public interface AdminDao {
    List<GradeRow> selectGrades();
    int updateGrade(String gradeCode, String gradeName, int minimumPoints, int sortOrder, String useYn);
    List<RolePermissionRow> selectRolePermissions();
    // upsert = 있으면 수정(update), 없으면 추가(insert).
    void upsertRolePermission(String memberRole, String permissionCode, String allowedYn);
    void insertVisitorEvent(String visitorKey, Long memberId, String visitedPath);
    // 방문자 수 = 서로 다른 visitorKey(브라우저 세션) 수. 같은 사람이 여러 화면을 봐도 1명으로 센다.
    long selectTodayVisitorCount();
    long selectMonthVisitorCount();
    List<VisitSeriesRow> selectDailyVisitSeries();
    List<VisitSeriesRow> selectMonthlyVisitSeries();
    List<RecentVisitRow> selectRecentVisits();
}
