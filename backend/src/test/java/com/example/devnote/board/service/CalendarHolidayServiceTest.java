package com.example.devnote.board.service;

import com.example.devnote.board.dao.CalendarHolidayDao;
import com.example.devnote.board.dao.CalendarHolidayCacheDao;
import com.example.devnote.board.dao.CalendarHolidayRow;
import com.example.devnote.board.dto.CalendarHolidayDtos.*;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class CalendarHolidayServiceTest {
    @Mock CalendarHolidayDao holidayDao;
    @Mock MemberDao memberDao;
    @Mock CalendarHolidayCacheDao cacheDao;
    @Mock KoreanHolidayApiClient api;
    CalendarHolidayService service;
    @BeforeEach void setUp() {
        service = new CalendarHolidayService(holidayDao, memberDao,
            new KoreanHolidaySourceService(cacheDao, api, new ObjectMapper().findAndRegisterModules()));
    }

    @Test void displaysConfirmedHolidaysAndSubstitutesIncludingThe2026Additions() {
        var may = service.month("2026-05");
        assertThat(may.officialDataAvailable()).isTrue();
        assertThat(may.content()).extracting(Holiday::date).containsExactly(
            LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 5), LocalDate.of(2026, 5, 24), LocalDate.of(2026, 5, 25));
        assertThat(may.content().getLast().kind()).isEqualTo(HolidayKind.SUBSTITUTE);
        assertThat(may.content()).allMatch(Holiday::official);
        assertThat(service.month("2026-07").content()).extracting(Holiday::name).contains("제헌절");
        assertThat(may.sourceUrls()).isNotEmpty();
        assertThat(may.verifiedAt()).isEqualTo(LocalDate.of(2026, 11, 13));
    }

    @Test void includesLunarNewYearAndSubstitutesWithoutTreatingAllSaturdayHolidaysTheSame() {
        assertThat(service.month("2027-02").content()).extracting(Holiday::date).containsExactly(
            LocalDate.of(2027, 2, 6), LocalDate.of(2027, 2, 7), LocalDate.of(2027, 2, 8), LocalDate.of(2027, 2, 9));
        assertThat(service.month("2027-05").content()).anyMatch(day -> day.date().equals(LocalDate.of(2027, 5, 3)) && day.kind() == HolidayKind.SUBSTITUTE);
        assertThat(service.month("2027-07").content()).anyMatch(day -> day.date().equals(LocalDate.of(2027, 7, 19)) && day.kind() == HolidayKind.SUBSTITUTE);
        assertThat(service.month("2027-12").content()).anyMatch(day -> day.date().equals(LocalDate.of(2027, 12, 27)) && day.kind() == HolidayKind.SUBSTITUTE);
        assertThat(service.month("2026-06").content()).noneMatch(day -> day.date().equals(LocalDate.of(2026, 6, 8)));
        assertThat(service.month("2026-09").content()).noneMatch(day -> day.date().equals(LocalDate.of(2026, 9, 28)));
    }

    @Test void reportsMissingOfficialYearWithoutHidingCustomHolidays() {
        when(holidayDao.list(LocalDate.of(2030, 11, 1), LocalDate.of(2030, 12, 1))).thenReturn(List.of(row()));
        var month = service.month("2030-11");
        assertThat(month.officialDataAvailable()).isFalse();
        assertThat(month.supportedYears()).containsExactly(2026, 2027);
        assertThat(month.verifiedAt()).isNull();
        assertThat(month.content()).hasSize(1).allMatch(day -> !day.official());
        assertThat(service.month("2026-11").officialDataAvailable()).isTrue();
        assertThat(service.month("2026-11").content()).isEmpty();
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.month("2026-13"));
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.month("2101-01"));
    }

    @Test void onlyAnActiveAdministratorCanModifyHolidays() {
        when(memberDao.selectMemberById(2L)).thenReturn(member("USER", "ACTIVE"));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.create(input(1L), 2L));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.update(1L, input(1L), 2L));
        assertError(ErrorCode.ACCESS_DENIED, () -> service.delete(1L, 1L, 2L));
        when(memberDao.selectMemberById(3L)).thenReturn(member("ADMIN", "SUSPENDED"));
        assertError(ErrorCode.AUTHENTICATION_REQUIRED, () -> service.create(input(null), 3L));
        verifyNoInteractions(holidayDao);
    }

    @Test void staleVersionsCannotUpdateOrDeleteAnotherEdit() {
        when(memberDao.selectMemberById(3L)).thenReturn(member("ADMIN", "ACTIVE"));
        when(holidayDao.find(1L)).thenReturn(row());
        assertError(ErrorCode.CALENDAR_HOLIDAY_VERSION_CONFLICT, () -> service.update(1L, input(2L), 3L));
        assertError(ErrorCode.CALENDAR_HOLIDAY_VERSION_CONFLICT, () -> service.delete(1L, 2L, 3L));
        assertError(ErrorCode.COMMON_INVALID_REQUEST, () -> service.update(1L, input(null), 3L));
        verify(holidayDao, never()).update(any());
        verify(holidayDao, never()).delete(anyLong(), anyLong());
    }

    @Test void duplicatesAndInvalidDatesAreExplicitErrors() {
        when(memberDao.selectMemberById(3L)).thenReturn(member("ADMIN", "ACTIVE"));
        assertError(ErrorCode.COMMON_INVALID_REQUEST,
            () -> service.create(new HolidayRequest(LocalDate.of(2101, 1, 1), "휴일", HolidayKind.TEMPORARY, null), 3L));
        assertError(ErrorCode.COMMON_INVALID_REQUEST,
            () -> service.create(new HolidayRequest(LocalDate.of(2026, 11, 13), " ", HolidayKind.TEMPORARY, null), 3L));
        assertError(ErrorCode.CALENDAR_HOLIDAY_EXISTS,
            () -> service.create(new HolidayRequest(LocalDate.of(2026, 5, 25), "대체공휴일(부처님오신날)", HolidayKind.SUBSTITUTE, null), 3L));
        doThrow(new DuplicateKeyException("duplicate")).when(holidayDao).insert(any());
        assertError(ErrorCode.CALENDAR_HOLIDAY_EXISTS, () -> service.create(input(null), 3L));
    }

    private HolidayRequest input(Long version) { return new HolidayRequest(LocalDate.of(2030, 11, 13), "회사 휴무", HolidayKind.COMPANY, version); }
    private CalendarHolidayRow row() {
        CalendarHolidayRow row = new CalendarHolidayRow();
        row.setHolidayId(1L); row.setHolidayDate(LocalDate.of(2030, 11, 13)); row.setHolidayName("회사 휴무");
        row.setHolidayKind("COMPANY"); row.setVersionNumber(1L);
        return row;
    }
    private MemberRow member(String role, String status) {
        MemberRow member = new MemberRow(); member.setMemberRole(role); member.setAccountStatus(status); member.setUseYn("Y"); return member;
    }
    private void assertError(ErrorCode code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(code);
    }
}
