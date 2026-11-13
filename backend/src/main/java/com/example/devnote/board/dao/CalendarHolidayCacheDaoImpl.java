package com.example.devnote.board.dao;

import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository @RequiredArgsConstructor
public class CalendarHolidayCacheDaoImpl implements CalendarHolidayCacheDao {
    private static final String NAMESPACE = "com.example.devnote.board.CalendarHolidayCacheMapper.";
    private final SqlSessionTemplate sqlSession;
    @Override public CalendarHolidayCacheRow find(int year) { return sqlSession.selectOne(NAMESPACE + "find", year); }
    @Override public List<Integer> years() { return sqlSession.selectList(NAMESPACE + "years"); }
    @Override public void save(CalendarHolidayCacheRow year) { sqlSession.insert(NAMESPACE + "save", year); }
}
