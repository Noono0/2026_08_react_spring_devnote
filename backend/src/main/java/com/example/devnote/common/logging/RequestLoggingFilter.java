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
        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedMilliseconds = Duration.between(startedAt, Instant.now()).toMillis();
            log.info("[HTTP-RESPONSE] method={}, uri={}, status={}, elapsedMs={}",
                request.getMethod(), request.getRequestURI(), response.getStatus(), elapsedMilliseconds);
        }
    }
}
