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
  *
  * [흐름]
  *   1. 프론트가 X-Request-Id 헤더를 보냈으면 그 값을, 없으면 새 UUID를 traceId로 쓴다.
  *   2. MDC에 넣으면 이 요청을 처리하는 동안 찍히는 모든 로그에 [traceId=...]가 자동으로 붙는다(application.yml의 로그 형식).
  *   3. 응답 헤더에도 같은 값을 돌려줘, 브라우저 개발자 도구에서 번호를 확인할 수 있다.
  *
  * @Order(1): 필터 중 가장 먼저 실행된다. 그래야 뒤의 요청 로그(RequestLoggingFilter)에도 traceId가 찍힌다.
  * OncePerRequestFilter: 내부 전달(forward) 등으로 같은 요청이 필터를 두 번 지나도 한 번만 실행되게 해 준다.
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
        // ★ finally에서 반드시 지운다. 서버는 스레드를 재사용하므로, 지우지 않으면 다음 요청의 로그에 이전 요청의 traceId·userId가 섞인다.
        //   (userId는 CurrentMemberProvider가 MDC에 넣는 값이다)
        } finally {
            MDC.remove("traceId");
            MDC.remove("userId");
        }
    }
}
