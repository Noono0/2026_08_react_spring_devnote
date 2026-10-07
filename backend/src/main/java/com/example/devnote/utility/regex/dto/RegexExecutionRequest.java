package com.example.devnote.utility.regex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 정규식 실행 요청.
 *   pattern    : 정규식(500자 이하)
 *   flags      : i(대소문자 무시) m(여러 줄) s(.이 줄바꿈 포함) u(유니코드 문자 클래스)
 *   input      : 검사할 글(10만 자 이하)
 *   mode       : FIND(모두 찾기) / FULL(전체가 일치하는지) / REPLACE(바꾸기)
 *   replacement: REPLACE일 때 바꿀 글. JavaScript식 $& · $<이름>도 받아 Java 문법으로 바꿔 준다.
 */
public record RegexExecutionRequest(
    @NotBlank @Size(max = 500) String pattern,
    @Size(max = 20) String flags,
    @Size(max = 100_000) String input,
    @NotBlank @Pattern(regexp = "FIND|FULL|REPLACE") String mode,
    @Size(max = 10_000) String replacement
) {
    /**
     * 공통 AOP 로그가 record 기본 toString()을 사용해도 패턴과 테스트 원문은 남기지 않는다.
     */
    @Override
    public String toString() {
        return "RegexExecutionRequest[pattern=<omitted>, flags=" + flags
            + ", input=<omitted>, mode=" + mode + ", replacement=<omitted>]";
    }
}
