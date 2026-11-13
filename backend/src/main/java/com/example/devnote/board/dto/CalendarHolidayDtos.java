package com.example.devnote.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public final class CalendarHolidayDtos {
    private CalendarHolidayDtos() {}
    public enum HolidayKind { PUBLIC, SUBSTITUTE, TEMPORARY, COMPANY }
    public enum HolidaySource { API, CACHE, SNAPSHOT, UNAVAILABLE }
    public record HolidayRequest(@NotNull LocalDate date, @NotBlank @Size(max = 80) String name,
        @NotNull HolidayKind kind, @Positive Long versionNumber) {}
    public record Holiday(Long holidayId, LocalDate date, String name, HolidayKind kind, boolean official, Long versionNumber) {}
    public record HolidayMonth(List<Holiday> content, boolean officialDataAvailable, List<Integer> supportedYears,
        List<String> sourceUrls, LocalDate verifiedAt, HolidaySource source, String warning) {}
    public record OfficialDay(LocalDate date, String name, HolidayKind kind) {}
    public record OfficialYear(int year, LocalDate verifiedAt, List<String> sourceUrls, List<OfficialDay> holidays) {}
}
