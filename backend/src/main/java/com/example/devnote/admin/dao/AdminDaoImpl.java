package com.example.devnote.admin.dao;

import com.example.devnote.admin.dao.row.GradeRow;
import com.example.devnote.admin.dao.row.RecentVisitRow;
import com.example.devnote.admin.dao.row.RolePermissionRow;
import com.example.devnote.admin.dao.row.VisitSeriesRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class AdminDaoImpl implements AdminDao {
    private static final String NAMESPACE = "com.example.devnote.admin.AdminMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override public List<GradeRow> selectGrades() { return sqlSessionTemplate.selectList(NAMESPACE + "selectGrades"); }
    @Override public int updateGrade(String gradeCode, String gradeName, int minimumPoints, int sortOrder, String useYn) {
        return sqlSessionTemplate.update(NAMESPACE + "updateGrade", Map.of("gradeCode", gradeCode, "gradeName", gradeName, "minimumPoints", minimumPoints, "sortOrder", sortOrder, "useYn", useYn));
    }
    @Override public List<RolePermissionRow> selectRolePermissions() { return sqlSessionTemplate.selectList(NAMESPACE + "selectRolePermissions"); }
    @Override public void upsertRolePermission(String memberRole, String permissionCode, String allowedYn) {
        sqlSessionTemplate.update(NAMESPACE + "upsertRolePermission", Map.of("memberRole", memberRole, "permissionCode", permissionCode, "allowedYn", allowedYn));
    }
    @Override public void insertVisitorEvent(String visitorKey, Long memberId, String visitedPath) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("visitorKey", visitorKey); parameters.put("memberId", memberId); parameters.put("visitedPath", visitedPath);
        sqlSessionTemplate.insert(NAMESPACE + "insertVisitorEvent", parameters);
    }
    @Override public long selectTodayVisitorCount() { return sqlSessionTemplate.selectOne(NAMESPACE + "selectTodayVisitorCount"); }
    @Override public long selectMonthVisitorCount() { return sqlSessionTemplate.selectOne(NAMESPACE + "selectMonthVisitorCount"); }
    @Override public List<VisitSeriesRow> selectDailyVisitSeries() { return sqlSessionTemplate.selectList(NAMESPACE + "selectDailyVisitSeries"); }
    @Override public List<VisitSeriesRow> selectMonthlyVisitSeries() { return sqlSessionTemplate.selectList(NAMESPACE + "selectMonthlyVisitSeries"); }
    @Override public List<RecentVisitRow> selectRecentVisits() { return sqlSessionTemplate.selectList(NAMESPACE + "selectRecentVisits"); }
}
