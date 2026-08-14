package com.example.devnote.common.api;

import org.slf4j.MDC;

/**
 * 정상 API 응답의 공통 형식입니다.
 * 오류 응답은 Spring의 ProblemDetail 형식을 사용합니다.
 */
public record ApiResponse<T>(
    boolean success,
    String code,
    String message,
    T data,
    String traceId
) {
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, "SUCCESS", "요청이 정상적으로 처리되었습니다.", data, MDC.get("traceId"));
    }

    public static <T> ApiResponse<T> created(T data) {
        return new ApiResponse<>(true, "CREATED", "데이터가 생성되었습니다.", data, MDC.get("traceId"));
    }
}
