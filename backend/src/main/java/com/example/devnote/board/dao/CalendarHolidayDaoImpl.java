package com.example.devnote.board.dao;

import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Repository @RequiredArgsConstructor
public class CalendarHolidayDaoImpl implements CalendarHolidayDao {
    private static final String NAMESPACE = "com.example.devnote.board.CalendarHolidayMapper.";
    private final SqlSessionTemplate sqlSession;
    @Override public List<CalendarHolidayRow> list(LocalDate startDate, LocalDate endDate) {
        return sqlSession.selectList(NAMESPACE + "list", Map.of("startDate", startDate, "endDate", endDate));
    }
    @Override public CalendarHolidayRow find(long holidayId) { return sqlSession.selectOne(NAMESPACE + "find", holidayId); }
    @Override public void insert(CalendarHolidayRow holiday) { sqlSession.insert(NAMESPACE + "insert", holiday); }
    @Override public int update(CalendarHolidayRow holiday) { return sqlSession.update(NAMESPACE + "update", holiday); }
    @Override public int delete(long holidayId, long versionNumber) {
        return sqlSession.delete(NAMESPACE + "delete", Map.of("holidayId", holidayId, "versionNumber", versionNumber));
    }
}
