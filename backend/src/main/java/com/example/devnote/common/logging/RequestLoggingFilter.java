package com.example.devnote.common.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

/**
 * 모든 HTTP 요청의 시작과 끝을 기록합니다. (메서드·주소·응답 상태·걸린 시간)
 *
 * @Order(10): TraceIdFilter(1) 다음에 실행되어 두 로그 모두 같은 traceId를 가진다.
 * ★ 요청 본문(body)은 기록하지 않는다. 비밀번호나 긴 문서 내용이 로그에 남는 것을 막기 위해서다.
 * @Slf4j: Lombok이 log 변수(private static final Logger log = ...)를 만들어 준다.
 */
@Slf4j
@Component
@Order(10)
public class RequestLoggingFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        Instant startedAt = Instant.now();
        log.info("[HTTP-REQUEST] method={}, uri={}, query={}",
            request.getMethod(), request.getRequestURI(), request.getQueryString());
        // 다음 필터 → (Spring Security) → Controller → Service … 로 요청을 넘긴다. 처리가 끝나면 이 줄 다음으로 돌아온다.
        // finally에 응답 로그를 둔 이유: 예외가 나도 "몇 ms 걸려 몇 번 상태로 끝났는지"는 남아야 하기 때문이다.
        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedMilliseconds = Duration.between(startedAt, Instant.now()).toMillis();
            log.info("[HTTP-RESPONSE] method={}, uri={}, status={}, elapsedMs={}",
                request.getMethod(), request.getRequestURI(), response.getStatus(), elapsedMilliseconds);
        }
    }
}
