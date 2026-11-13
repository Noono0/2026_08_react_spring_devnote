package com.example.devnote.board.dao;

import java.time.LocalDate;
import java.util.List;

public interface CalendarHolidayDao {
    List<CalendarHolidayRow> list(LocalDate startDate, LocalDate endDate);
    CalendarHolidayRow find(long holidayId);
    void insert(CalendarHolidayRow holiday);
    int update(CalendarHolidayRow holiday);
    int delete(long holidayId, long versionNumber);
}
