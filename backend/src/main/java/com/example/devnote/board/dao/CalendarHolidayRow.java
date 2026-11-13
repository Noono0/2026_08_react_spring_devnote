package com.example.devnote.board.dao;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;

@Getter @Setter
public class CalendarHolidayRow {
    private Long holidayId;
    private LocalDate holidayDate;
    private String holidayName;
    private String holidayKind;
    private Long versionNumber;
}
