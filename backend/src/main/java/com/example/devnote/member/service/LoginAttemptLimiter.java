package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 무차별 대입(brute force) 방어: 같은 IP에서 같은 아이디로 연속 실패하면 잠시 로그인을 막습니다.
 *
 * [규칙] (application.yml의 auth.login-limit.* 로 바꿀 수 있다)
 *   - 실패 기록은 첫 실패부터 failure-window(기본 15분) 동안 센다. 그 시간이 지나면 0부터 다시 센다.
 *   - 그 안에 max-failures(기본 5)번 틀리면 lock-duration(기본 15분) 동안 맞는 비밀번호를 넣어도 거부한다(429).
 *   - 로그인에 성공하면 그 기록을 지운다.
 *
 * [왜 "IP + 아이디" 조합으로 셀까?]
 *   ❌ 아이디만으로 세면: 공격자가 일부러 admin으로 5번 틀려서 진짜 관리자까지 로그인 못 하게 만들 수 있다(잠금 악용).
 *   ❌ IP만으로 세면: 회사·학교처럼 IP 하나를 여럿이 쓰는 곳에서 한 사람 실수로 모두가 막힌다.
 *   ✓ 둘을 묶으면 "이 IP에서 이 아이디를 계속 두드리는" 공격만 정확히 늦출 수 있다.
 *   한계: IP를 계속 바꾸는 분산 공격까지 막지는 못한다. 그때는 Nginx 요청 제한·CAPTCHA 같은 장치를 더한다.
 *
 * [왜 DB가 아니라 메모리(ConcurrentHashMap)일까?]
 *   이 서비스는 앱 서버가 1대라 메모리로 충분하고, 기록이 서버 재시작 때 사라져도 위험이 작다(잠금이 풀릴 뿐).
 *   서버를 여러 대로 늘리면 Redis 같은 공용 저장소로 옮겨야 한다.
 *   ConcurrentHashMap: 여러 요청(스레드)이 동시에 읽고 써도 안전한 Map. 일반 HashMap은 동시 수정 시 망가질 수 있다.
 */
@Component
public class LoginAttemptLimiter {
    /** 이 개수를 넘으면 만료된 기록을 한 번 청소한다(메모리가 끝없이 늘지 않게). */
    private static final int CLEANUP_THRESHOLD = 10_000;

    private final Clock clock;
    private final int maxFailures;
    private final Duration failureWindow;
    private final Duration lockDuration;
    private final Map<String, AttemptRecord> attemptRecords = new ConcurrentHashMap<>();

    /**
     * 한 키(IP+아이디)의 실패 기록. record는 값이 바뀌지 않는 불변 객체라, 바꿀 때는 새 객체로 통째로 교체한다.
     * lockedUntil이 null이면 아직 잠기지 않은 상태다.
     */
    private record AttemptRecord(int failureCount, Instant windowStartedAt, Instant lockedUntil) {
    }

    /** 실제 서버에서 쓰는 생성자. 시계는 시스템 시간이다. */
    @Autowired
    public LoginAttemptLimiter(
        @Value("${auth.login-limit.max-failures:5}") int maxFailures,
        @Value("${auth.login-limit.failure-window:15m}") Duration failureWindow,
        @Value("${auth.login-limit.lock-duration:15m}") Duration lockDuration
    ) {
        this(Clock.systemUTC(), maxFailures, failureWindow, lockDuration);
    }

    /** 테스트용 생성자. 가짜 시계를 넣으면 15분을 실제로 기다리지 않고 시간 경과를 흉내 낼 수 있다. */
    LoginAttemptLimiter(Clock clock, int maxFailures, Duration failureWindow, Duration lockDuration) {
        this.clock = clock;
        this.maxFailures = maxFailures;
        this.failureWindow = failureWindow;
        this.lockDuration = lockDuration;
    }

    /** 잠긴 상태면 남은 시간을 알려 주는 429 예외를 던진다. 비밀번호 확인보다 먼저 호출한다. */
    public void checkAllowed(String clientAddress, String loginId) {
        AttemptRecord attemptRecord = attemptRecords.get(createKey(clientAddress, loginId));
        Instant now = clock.instant();
        if (attemptRecord == null || attemptRecord.lockedUntil() == null || !now.isBefore(attemptRecord.lockedUntil())) {
            return;
        }
        // 남은 시간을 분 단위로 올림해 보여 준다. (예: 30초 남음 → "1분 뒤")
        long remainingMinutes = Math.max(1, (Duration.between(now, attemptRecord.lockedUntil()).toSeconds() + 59) / 60);
        throw new BusinessException(
            ErrorCode.LOGIN_TEMPORARILY_LOCKED,
            "로그인 실패가 반복되어 잠시 로그인할 수 없습니다. " + remainingMinutes + "분 뒤 다시 시도해 주세요."
        );
    }

    /** 로그인 실패를 기록한다. max-failures번째 실패에서 잠근다. */
    public void recordFailure(String clientAddress, String loginId) {
        Instant now = clock.instant();
        cleanUpExpiredRecordsWhenLarge(now);
        // compute: "이 키의 현재 값으로 새 값을 계산해 넣는다"를 한 번에(원자적으로) 처리한다.
        //   get → 계산 → put을 따로 하면 동시에 들어온 두 실패 중 하나가 사라질 수 있다.
        attemptRecords.compute(createKey(clientAddress, loginId), (key, previousRecord) -> {
            // 기록이 없거나, 셈 시작 후 failure-window가 지났거나, 잠금이 이미 끝났으면 1부터 새로 센다.
            boolean startNewWindow = previousRecord == null
                || !now.isBefore(previousRecord.windowStartedAt().plus(failureWindow))
                || (previousRecord.lockedUntil() != null && !now.isBefore(previousRecord.lockedUntil()));
            int failureCount = startNewWindow ? 1 : previousRecord.failureCount() + 1;
            Instant windowStartedAt = startNewWindow ? now : previousRecord.windowStartedAt();
            Instant lockedUntil = failureCount >= maxFailures ? now.plus(lockDuration) : null;
            return new AttemptRecord(failureCount, windowStartedAt, lockedUntil);
        });
    }

    /** 로그인 성공 시 그 키의 실패 기록을 지운다. */
    public void reset(String clientAddress, String loginId) {
        attemptRecords.remove(createKey(clientAddress, loginId));
    }

    /** "IP|아이디" 형태의 키. 아이디는 대소문자·앞뒤 공백을 무시해 "Admin"과 "admin "을 같은 시도로 센다. */
    private String createKey(String clientAddress, String loginId) {
        String normalizedAddress = clientAddress == null ? "unknown" : clientAddress;
        return normalizedAddress + "|" + loginId.trim().toLowerCase(Locale.ROOT);
    }

    /** 기록이 많이 쌓였을 때만, 잠금도 셈 시간도 끝난 기록을 지운다. */
    private void cleanUpExpiredRecordsWhenLarge(Instant now) {
        if (attemptRecords.size() < CLEANUP_THRESHOLD) {
            return;
        }
        attemptRecords.entrySet().removeIf(entry -> {
            AttemptRecord attemptRecord = entry.getValue();
            boolean windowExpired = !now.isBefore(attemptRecord.windowStartedAt().plus(failureWindow));
            boolean lockExpired = attemptRecord.lockedUntil() == null || !now.isBefore(attemptRecord.lockedUntil());
            return windowExpired && lockExpired;
        });
    }
}
