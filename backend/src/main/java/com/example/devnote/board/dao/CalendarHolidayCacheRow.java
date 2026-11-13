package com.example.devnote.board.dao;

import java.time.LocalDate;

public record CalendarHolidayCacheRow(int holidayYear, String contentJson, LocalDate verifiedDate) {}
