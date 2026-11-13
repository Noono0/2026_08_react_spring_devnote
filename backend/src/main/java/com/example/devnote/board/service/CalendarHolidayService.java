package com.example.devnote.board.service;

import com.example.devnote.board.dao.CalendarHolidayDao;
import com.example.devnote.board.dao.CalendarHolidayRow;
import com.example.devnote.board.dto.CalendarHolidayDtos.*;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dto.MemberRole;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** 확인한 공식 연도 자료와 관리자 추가 휴일을 합친다. 미지원 연도의 음력·대체일은 추측하지 않는다. */
@Service
public class CalendarHolidayService {
    private final CalendarHolidayDao holidayDao;
    private final MemberDao memberDao;
    private final KoreanHolidaySourceService officialSource;

    public CalendarHolidayService(CalendarHolidayDao holidayDao, MemberDao memberDao, KoreanHolidaySourceService officialSource) {
        this.holidayDao = holidayDao;
        this.memberDao = memberDao;
        this.officialSource = officialSource;
    }

    public HolidayMonth month(String value) {
        YearMonth month = parseMonth(value);
        var selected = officialSource.year(month.getYear());
        OfficialYear official = selected.data();
        List<Holiday> days = new ArrayList<>();
        if (official != null) {
            official.holidays().stream().filter(day -> YearMonth.from(day.date()).equals(month))
                .map(day -> new Holiday(null, day.date(), day.name(), day.kind(), true, null)).forEach(days::add);
        }
        holidayDao.list(month.atDay(1), month.plusMonths(1).atDay(1)).stream().map(this::toHoliday).forEach(days::add);
        days.sort(Comparator.comparing(Holiday::date).thenComparing(Holiday::name));
        return new HolidayMonth(List.copyOf(days), official != null, officialSource.supportedYears(),
            official == null ? List.of() : official.sourceUrls(), official == null ? null : official.verifiedAt(), selected.source(), selected.warning());
    }

    @Transactional
    public Holiday create(HolidayRequest request, long memberId) {
        requireAdministrator(memberId);
        CalendarHolidayRow row = new CalendarHolidayRow();
        fill(row, request);
        try { holidayDao.insert(row); }
        catch (DuplicateKeyException exception) { throw new BusinessException(ErrorCode.CALENDAR_HOLIDAY_EXISTS); }
        return toHoliday(requireHoliday(row.getHolidayId()));
    }

    @Transactional
    public Holiday update(long holidayId, HolidayRequest request, long memberId) {
        requireAdministrator(memberId);
        CalendarHolidayRow row = requireHoliday(holidayId);
        requireVersion(row, request.versionNumber());
        fill(row, request);
        try {
            if (holidayDao.update(row) == 0) throw new BusinessException(ErrorCode.CALENDAR_HOLIDAY_VERSION_CONFLICT);
        } catch (DuplicateKeyException exception) { throw new BusinessException(ErrorCode.CALENDAR_HOLIDAY_EXISTS); }
        return toHoliday(requireHoliday(holidayId));
    }

    @Transactional
    public void delete(long holidayId, long versionNumber, long memberId) {
        requireAdministrator(memberId);
        requireVersion(requireHoliday(holidayId), versionNumber);
        if (holidayDao.delete(holidayId, versionNumber) == 0) throw new BusinessException(ErrorCode.CALENDAR_HOLIDAY_VERSION_CONFLICT);
    }

    private YearMonth parseMonth(String value) {
        try {
            YearMonth month = YearMonth.parse(value);
            if (month.getYear() < 1900 || month.getYear() > 2100) throw new IllegalArgumentException();
            return month;
        } catch (DateTimeParseException | IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "조회할 달은 1900~2100년의 YYYY-MM 형식이어야 합니다.");
        }
    }

    private void fill(CalendarHolidayRow row, HolidayRequest request) {
        if (request.date() == null || request.date().getYear() < 1900 || request.date().getYear() > 2100
            || request.name() == null || request.name().isBlank() || request.name().trim().length() > 80 || request.kind() == null) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "휴일 날짜·이름·종류를 확인해 주세요.");
        }
        row.setHolidayDate(request.date());
        row.setHolidayName(request.name().trim());
        row.setHolidayKind(request.kind().name());
        var official = officialSource.year(request.date().getYear()).data();
        if (official != null && official.holidays().stream()
            .anyMatch(day -> day.date().equals(row.getHolidayDate()) && day.name().equals(row.getHolidayName()))) {
            throw new BusinessException(ErrorCode.CALENDAR_HOLIDAY_EXISTS);
        }
    }

    private void requireAdministrator(long memberId) {
        var member = memberDao.selectMemberById(memberId);
        if (member == null || !"Y".equals(member.getUseYn()) || !"ACTIVE".equals(member.getAccountStatus())) {
            throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        }
        if (!MemberRole.valueOf(member.getMemberRole()).isAdministrator()) throw new BusinessException(ErrorCode.ACCESS_DENIED);
    }

    private CalendarHolidayRow requireHoliday(long id) {
        CalendarHolidayRow row = holidayDao.find(id);
        if (row == null) throw new BusinessException(ErrorCode.CALENDAR_HOLIDAY_NOT_FOUND);
        return row;
    }

    private void requireVersion(CalendarHolidayRow row, Long version) {
        if (version == null || version < 1) throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "휴일 버전이 필요합니다.");
        if (!version.equals(row.getVersionNumber())) throw new BusinessException(ErrorCode.CALENDAR_HOLIDAY_VERSION_CONFLICT);
    }

    private Holiday toHoliday(CalendarHolidayRow row) {
        return new Holiday(row.getHolidayId(), row.getHolidayDate(), row.getHolidayName(), HolidayKind.valueOf(row.getHolidayKind()), false, row.getVersionNumber());
    }
}
