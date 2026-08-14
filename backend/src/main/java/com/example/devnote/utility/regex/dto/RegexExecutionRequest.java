package com.example.devnote.utility.regex.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

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
