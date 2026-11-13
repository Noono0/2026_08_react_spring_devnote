package com.example.devnote.board.dao;

import java.util.List;

public interface CalendarHolidayCacheDao {
    CalendarHolidayCacheRow find(int year);
    List<Integer> years();
    void save(CalendarHolidayCacheRow year);
}
