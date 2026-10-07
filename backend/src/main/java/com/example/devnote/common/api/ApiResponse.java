package com.example.devnote.common.api;

import org.slf4j.MDC;

/**
 * 정상 API 응답의 공통 형식입니다.
 * 오류 응답은 Spring의 ProblemDetail 형식을 사용합니다.
 *
 * [왜 모든 응답을 같은 "봉투"에 담나?]
 *   응답 모양이 API마다 다르면 프론트엔드가 API마다 다르게 꺼내야 한다.
 *   항상 아래 모양이면 프론트는 data만 꺼내면 된다. (frontend/src/shared/api/apiResponseTypes.ts와 짝)
 *     {
 *       "success": true,
 *       "code": "SUCCESS",
 *       "message": "요청이 정상적으로 처리되었습니다.",
 *       "data": { ...실제 결과... },
 *       "traceId": "a1b2c3..."     ← 서버 로그에서 이 요청을 찾는 번호
 *     }
 *
 * [record란?]
 *   값을 담기만 하는 클래스를 짧게 쓰는 Java 문법이다.
 *   생성자·getter(success(), data() …)·equals·toString을 컴파일러가 만들어 준다.
 *   만든 뒤에는 값을 바꿀 수 없다(불변). 응답처럼 "한 번 만들어 보내기만 하는" 데이터에 잘 맞는다.
 *
 * <T>: data에 무엇이든 담을 수 있게 하는 제네릭. ApiResponse&lt;DocumentDetailResponse&gt;처럼 쓴다.
 */
public record ApiResponse<T>(
    boolean success,
    String code,
    String message,
    T data,
    String traceId
) {
    /**
     * 조회·수정 성공 응답(HTTP 200).
     *
     * MDC.get("traceId"): TraceIdFilter가 요청마다 만들어 둔 추적 번호를 꺼낸다.
     *   MDC는 "현재 요청을 처리하는 스레드"에 값을 붙여 두는 로그용 보관함이다.
     *   같은 번호가 로그에도 찍히므로, 화면에서 오류 번호를 받으면 서버 로그에서 바로 찾을 수 있다.
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, "SUCCESS", "요청이 정상적으로 처리되었습니다.", data, MDC.get("traceId"));
    }

    /**
     * 생성 성공 응답. 본문의 code만 "CREATED"로 다르다.
     * ★ HTTP 상태 코드를 201로 바꾸는 것은 이 메서드가 아니라 Controller의 @ResponseStatus 또는 ResponseEntity가 한다.
     */
    public static <T> ApiResponse<T> created(T data) {
        return new ApiResponse<>(true, "CREATED", "데이터가 생성되었습니다.", data, MDC.get("traceId"));
    }
}
