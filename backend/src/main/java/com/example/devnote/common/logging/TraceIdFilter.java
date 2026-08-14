package com.example.devnote.common.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 프론트 요청부터 Controller, Service, DAO, SQL 로그까지 같은 요청인지 찾기 위한 traceId를 만듭니다.
 */
@Component
@Order(1)
public class TraceIdFilter extends OncePerRequestFilter {
    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        String traceId = requestId == null || requestId.isBlank()
            ? UUID.randomUUID().toString().replace("-", "")
            : requestId;

        MDC.put("traceId", traceId);
        response.setHeader(REQUEST_ID_HEADER, traceId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("traceId");
            MDC.remove("userId");
        }
    }
}
