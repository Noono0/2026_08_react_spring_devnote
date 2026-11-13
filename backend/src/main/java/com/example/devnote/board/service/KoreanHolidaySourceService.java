package com.example.devnote.board.service;

import com.example.devnote.board.dao.CalendarHolidayCacheDao;
import com.example.devnote.board.dao.CalendarHolidayCacheRow;
import com.example.devnote.board.dto.CalendarHolidayDtos.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/** API → MySQL 저장본 → 포함 자료 순서로 선택한다. 조회 시 한국 날짜마다 한 번 갱신한다. */
@Service
public class KoreanHolidaySourceService {
    private static final Logger log = LoggerFactory.getLogger(KoreanHolidaySourceService.class);
    private final CalendarHolidayCacheDao cacheDao;
    private final KoreanHolidayApiClient api;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final List<OfficialYear> snapshots;
    private final Map<Integer, Instant> nextAttempts = new ConcurrentHashMap<>();
    private final Map<Integer, Object> yearLocks = new ConcurrentHashMap<>();

    @Autowired
    public KoreanHolidaySourceService(CalendarHolidayCacheDao cacheDao, KoreanHolidayApiClient api, ObjectMapper mapper) {
        this(cacheDao, api, mapper, Clock.system(ZoneId.of("Asia/Seoul")));
    }

    KoreanHolidaySourceService(CalendarHolidayCacheDao cacheDao, KoreanHolidayApiClient api, ObjectMapper mapper, Clock clock) {
        this.cacheDao = cacheDao;
        this.api = api;
        this.mapper = mapper;
        this.clock = clock;
        try (var input = new ClassPathResource("calendar/korean-holidays.json").getInputStream()) {
            snapshots = mapper.readValue(input, new TypeReference<List<OfficialYear>>() {});
            for (OfficialYear year : snapshots) validate(year, year.year());
        } catch (IOException exception) { throw new IllegalStateException("공식 공휴일 포함 자료를 읽을 수 없습니다.", exception); }
    }

    public record YearData(OfficialYear data, HolidaySource source, String warning) {}

    // 같은 연도만 직렬화한다. 느린 API 호출이 다른 연도의 저장본 조회까지 막지 않는다.
    public YearData year(int year) {
        if (year < 1900 || year > 2100) throw new IllegalArgumentException("지원하지 않는 연도입니다.");
        synchronized (yearLocks.computeIfAbsent(year, ignored -> new Object())) {
            return loadYear(year);
        }
    }

    private YearData loadYear(int year) {
        LocalDate today = LocalDate.now(clock);
        OfficialYear cached = readCache(year);
        if (cached != null && !cached.verifiedAt().isBefore(today)) return new YearData(cached, HolidaySource.CACHE, "");
        boolean configured = api.isConfigured();
        if (configured && !clock.instant().isBefore(nextAttempts.getOrDefault(year, Instant.MIN))) {
            try {
                var updated = new OfficialYear(year, today, List.of(KoreanHolidayApiClient.SOURCE_URL), api.fetchYear(year));
                validate(updated, year);
                cacheDao.save(new CalendarHolidayCacheRow(year, mapper.writeValueAsString(updated), today));
                nextAttempts.remove(year);
                return new YearData(updated, HolidaySource.API, "");
            } catch (IOException exception) {
                // 인증키·원본 XML·인증 URL은 기록하지 않는다.
                log.warn("공휴일 API 갱신 실패: {}년. 마지막 저장 자료 또는 포함 자료를 사용합니다.", year);
                nextAttempts.put(year, clock.instant().plus(Duration.ofHours(1)));
            }
        }
        String warning = configured ? "공휴일 API 갱신에 실패했습니다. 마지막으로 확인한 자료를 표시합니다."
            : "공휴일 API 인증키가 설정되지 않아 저장된 자료를 표시합니다.";
        if (cached != null) return new YearData(cached, HolidaySource.CACHE, warning);
        var snapshot = snapshots.stream().filter(value -> value.year() == year).findFirst().orElse(null);
        return new YearData(snapshot, snapshot == null ? HolidaySource.UNAVAILABLE : HolidaySource.SNAPSHOT,
            snapshot == null ? "조회 가능한 공식 공휴일 자료가 없습니다. API 설정·자료 발표 여부를 확인해 주세요." : warning);
    }

    public List<Integer> supportedYears() {
        return Stream.concat(snapshots.stream().map(OfficialYear::year), cacheDao.years().stream()).distinct().sorted().toList();
    }

    private OfficialYear readCache(int year) {
        var row = cacheDao.find(year);
        if (row == null) return null;
        try {
            var cached = mapper.readValue(row.contentJson(), OfficialYear.class);
            validate(cached, year);
            if (!cached.verifiedAt().equals(row.verifiedDate())) throw new IOException("저장된 공휴일 확인일이 일치하지 않습니다.");
            if (cached.verifiedAt().isAfter(LocalDate.now(clock))) throw new IOException("공휴일 확인일은 미래일 수 없습니다.");
            return cached;
        } catch (IOException exception) {
            log.warn("저장된 공휴일 자료 형식 오류: {}년. 다시 조회합니다.", year);
            return null;
        }
    }

    private static void validate(OfficialYear data, int year) throws IOException {
        if (data == null || data.year() != year || data.verifiedAt() == null || data.sourceUrls() == null || data.sourceUrls().isEmpty()
            || data.sourceUrls().stream().anyMatch(url -> url == null || !url.startsWith("https://")) || data.holidays() == null || data.holidays().isEmpty()) {
            throw new IOException("공휴일 자료의 연도·출처·확인일이 올바르지 않습니다.");
        }
        for (var day : data.holidays()) {
            if (day == null || day.date() == null || day.date().getYear() != year || day.name() == null || day.name().isBlank() || day.name().length() > 80
                || (day.kind() != HolidayKind.PUBLIC && day.kind() != HolidayKind.SUBSTITUTE && day.kind() != HolidayKind.TEMPORARY)) {
                throw new IOException("공휴일 자료의 날짜·이름·종류가 올바르지 않습니다.");
            }
        }
    }
}
