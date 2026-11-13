package com.example.devnote.board.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.assertThat;

/** 명시적으로 켠 경우에만 개인 환경 변수의 키로 공식 서버와 통신한다. 키는 출력하지 않는다. */
@EnabledIfEnvironmentVariable(named = "RUN_HOLIDAY_API_EXTERNAL_TEST", matches = "true")
class KoreanHolidayApiExternalTest {
    @Test void fetchesPublished2026And2027DatesUsingTheRealClient() throws Exception {
        var key = System.getenv("DATA_GO_KR_SERVICE_KEY");
        assertThat(key).as("DATA_GO_KR_SERVICE_KEY 설정 여부").isNotNull();
        var client = new KoreanHolidayApiClient(key);
        var current = client.fetchYear(2026);
        var next = client.fetchYear(2027);
        assertThat(current).anyMatch(day -> day.date().equals(LocalDate.of(2026, 5, 25)) && day.name().contains("대체공휴일"));
        assertThat(next).anyMatch(day -> day.date().equals(LocalDate.of(2027, 2, 9)) && day.name().contains("대체공휴일"));
        assertThat(current).allMatch(day -> day.date().getYear() == 2026);
        assertThat(next).allMatch(day -> day.date().getYear() == 2027);
    }
}
