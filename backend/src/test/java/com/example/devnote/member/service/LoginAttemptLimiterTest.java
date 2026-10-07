package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 로그인 실패 제한 규칙을 시간 흐름까지 포함해 확인한다.
 * 실제로 15분을 기다릴 수 없으므로, 원하는 만큼 앞으로 돌릴 수 있는 가짜 시계(MutableClock)를 쓴다.
 */
class LoginAttemptLimiterTest {
    private static final String ADDRESS = "203.0.113.20";

    /** instant 값을 직접 바꿀 수 있는 테스트용 시계. */
    private static final class MutableClock extends Clock {
        private Instant currentInstant = Instant.parse("2026-10-08T00:00:00Z");

        void advance(Duration duration) {
            currentInstant = currentInstant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return currentInstant;
        }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock, 5, Duration.ofMinutes(15), Duration.ofMinutes(15));

    private void failTimes(String loginId, int times) {
        for (int attempt = 0; attempt < times; attempt++) {
            limiter.recordFailure(ADDRESS, loginId);
        }
    }

    @Test
    void locksAfterMaxFailuresAndTellsRemainingMinutes() {
        failTimes("admin", 4);
        assertThatCode(() -> limiter.checkAllowed(ADDRESS, "admin")).doesNotThrowAnyException();

        failTimes("admin", 1);
        assertThatThrownBy(() -> limiter.checkAllowed(ADDRESS, "admin"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("15분 뒤")
            .extracting(exception -> ((BusinessException) exception).getErrorCode())
            .isEqualTo(ErrorCode.LOGIN_TEMPORARILY_LOCKED);
    }

    @Test
    void unlocksAfterLockDurationAndStartsCountingAgain() {
        failTimes("admin", 5);
        clock.advance(Duration.ofMinutes(15));

        assertThatCode(() -> limiter.checkAllowed(ADDRESS, "admin")).doesNotThrowAnyException();
        // 잠금이 끝난 뒤의 실패는 1부터 다시 센다. 한 번 틀렸다고 바로 다시 잠기지 않는다.
        failTimes("admin", 1);
        assertThatCode(() -> limiter.checkAllowed(ADDRESS, "admin")).doesNotThrowAnyException();
    }

    @Test
    void failuresOlderThanWindowAreForgotten() {
        failTimes("admin", 4);
        clock.advance(Duration.ofMinutes(16));
        failTimes("admin", 1);

        assertThatCode(() -> limiter.checkAllowed(ADDRESS, "admin")).doesNotThrowAnyException();
    }

    @Test
    void successResetsFailures() {
        failTimes("admin", 4);
        limiter.reset(ADDRESS, "admin");
        failTimes("admin", 4);

        assertThatCode(() -> limiter.checkAllowed(ADDRESS, "admin")).doesNotThrowAnyException();
    }

    @Test
    void countsPerAddressAndLoginIdIgnoringCaseAndSpaces() {
        failTimes("Admin ", 5);

        // 대소문자·앞뒤 공백만 다른 아이디는 같은 시도로 본다.
        assertThatThrownBy(() -> limiter.checkAllowed(ADDRESS, "admin")).isInstanceOf(BusinessException.class);
        // 다른 IP나 다른 아이디는 영향을 받지 않는다(공격자가 진짜 관리자를 잠그지 못하게).
        assertThatCode(() -> limiter.checkAllowed("198.51.100.7", "admin")).doesNotThrowAnyException();
        assertThatCode(() -> limiter.checkAllowed(ADDRESS, "editor")).doesNotThrowAnyException();
    }
}
