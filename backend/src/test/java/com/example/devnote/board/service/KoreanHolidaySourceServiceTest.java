package com.example.devnote.board.service;

import com.example.devnote.board.dao.CalendarHolidayCacheDao;
import com.example.devnote.board.dao.CalendarHolidayCacheRow;
import com.example.devnote.board.dto.CalendarHolidayDtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.io.IOException;
import java.time.*;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class KoreanHolidaySourceServiceTest {
    @Mock CalendarHolidayCacheDao dao;
    @Mock KoreanHolidayApiClient api;
    ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    Clock clock = Clock.fixed(Instant.parse("2026-11-12T15:01:00Z"), ZoneId.of("Asia/Seoul"));
    KoreanHolidaySourceService service;
    @BeforeEach void setUp() { service = new KoreanHolidaySourceService(dao, api, mapper, clock); }

    @Test void fetchesNewYearAndPersistsItsVerifiedDateInKoreanTime() throws Exception {
        when(api.isConfigured()).thenReturn(true);
        when(api.fetchYear(2028)).thenReturn(days(2028));
        var result = service.year(2028);
        assertThat(result.source()).isEqualTo(HolidaySource.API);
        assertThat(result.data().verifiedAt()).isEqualTo(LocalDate.of(2026, 11, 13));
        verify(dao).save(argThat(row -> row.holidayYear() == 2028 && row.contentJson().contains("신정") && row.verifiedDate().equals(LocalDate.of(2026, 11, 13))));
    }

    @Test void usesTodaysDatabaseCacheWithoutCallingTheApi() throws Exception {
        when(dao.find(2028)).thenReturn(row(2028, LocalDate.of(2026, 11, 13)));
        assertThat(service.year(2028).source()).isEqualTo(HolidaySource.CACHE);
        verifyNoInteractions(api);
        verify(dao, never()).save(any());
    }

    @Test void outagePreservesStaleDataAndThrottlesTheNextAttempt() throws Exception {
        when(dao.find(2028)).thenReturn(row(2028, LocalDate.of(2026, 11, 12)));
        when(api.isConfigured()).thenReturn(true);
        when(api.fetchYear(2028)).thenThrow(new IOException("unavailable"));
        assertThat(service.year(2028).source()).isEqualTo(HolidaySource.CACHE);
        assertThat(service.year(2028).warning()).contains("갱신에 실패");
        verify(api, times(1)).fetchYear(2028);
        verify(dao, never()).save(any());
        assertThat(service.year(2028).data().verifiedAt()).isEqualTo(LocalDate.of(2026, 11, 12));
    }

    @Test void refreshesYesterdayAndDoesNotOverwriteItWithAnEmptyYear() throws Exception {
        when(dao.find(2028)).thenReturn(row(2028, LocalDate.of(2026, 11, 12)));
        when(api.isConfigured()).thenReturn(true);
        when(api.fetchYear(2028)).thenReturn(List.of());
        assertThat(service.year(2028).source()).isEqualTo(HolidaySource.CACHE);
        verify(dao, never()).save(any());
        var later = new KoreanHolidaySourceService(dao, api, mapper, Clock.offset(clock, Duration.ofHours(2)));
        when(api.fetchYear(2028)).thenReturn(days(2028));
        assertThat(later.year(2028).source()).isEqualTo(HolidaySource.API);
        verify(dao).save(any());
    }

    @Test void invalidStoredJsonFallsBackToSnapshotAndUnknownYearsRemainUnavailable() {
        when(dao.find(2026)).thenReturn(new CalendarHolidayCacheRow(2026, "not-json", LocalDate.of(2026, 11, 13)));
        assertThat(service.year(2026).source()).isEqualTo(HolidaySource.SNAPSHOT);
        assertThat(service.year(2030).source()).isEqualTo(HolidaySource.UNAVAILABLE);
        assertThat(service.year(2030).data()).isNull();
        verify(api, times(3)).isConfigured();
        verifyNoMoreInteractions(api);
    }

    @Test void supportedYearsIncludeCachedYearsAndDeduplicateSnapshots() {
        when(dao.years()).thenReturn(List.of(2027, 2028));
        assertThat(service.supportedYears()).containsExactly(2026, 2027, 2028);
    }

    @Test void futureVerificationDateMustNotPreventRefresh() throws Exception {
        when(dao.find(2028)).thenReturn(row(2028, LocalDate.of(2099, 1, 1)));
        when(api.isConfigured()).thenReturn(true);
        when(api.fetchYear(2028)).thenReturn(days(2028));
        assertThat(service.year(2028).source()).isEqualTo(HolidaySource.API);
        verify(api).fetchYear(2028);
    }

    @Test void slowApiYearDoesNotBlockAnotherYearsFreshCache() throws Exception {
        var entered = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        when(api.isConfigured()).thenReturn(true);
        when(dao.find(2028)).thenReturn(null);
        when(dao.find(2027)).thenReturn(row(2027, LocalDate.of(2026, 11, 13)));
        when(api.fetchYear(2028)).thenAnswer(call -> {
            entered.countDown();
            if (!release.await(3, java.util.concurrent.TimeUnit.SECONDS)) throw new IOException("테스트 응답 대기 초과");
            return days(2028);
        });
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var slow = executor.submit(() -> service.year(2028));
            assertThat(entered.await(1, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            var cached = executor.submit(() -> service.year(2027));
            assertThat(cached.get(1, java.util.concurrent.TimeUnit.SECONDS).source()).isEqualTo(HolidaySource.CACHE);
            release.countDown();
            assertThat(slow.get(2, java.util.concurrent.TimeUnit.SECONDS).source()).isEqualTo(HolidaySource.API);
        } finally { release.countDown(); executor.shutdownNow(); }
    }

    private List<OfficialDay> days(int year) { return List.of(new OfficialDay(LocalDate.of(year, 1, 1), "신정", HolidayKind.PUBLIC)); }
    private CalendarHolidayCacheRow row(int year, LocalDate verifiedAt) throws Exception {
        return new CalendarHolidayCacheRow(year, mapper.writeValueAsString(new OfficialYear(year, verifiedAt, List.of(KoreanHolidayApiClient.SOURCE_URL), days(year))), verifiedAt);
    }
}
