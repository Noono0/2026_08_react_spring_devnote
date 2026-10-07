package com.example.devnote.snippet.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 코드 조각 저장 요청. 코드는 최대 20만 자, 태그는 10개(각 30자)까지.
 * description은 @NotNull이라 빈 문자열("")은 되지만 아예 빠지면 안 된다.
 */
public record SnippetSaveRequest(
    @NotBlank @Size(max = 200) String title,
    @NotNull @Size(max = 1000) String description,
    @NotBlank @Size(max = 50) String language,
    @NotBlank @Size(max = 200_000) String code,
    @NotNull @Size(max = 10) List<@Valid @NotBlank @Size(max = 30) String> tags,
    boolean favorite
) {
    /**
     * 회원의 코드와 설명이 공통 메서드 로그에 노출되지 않게 요약 정보만 반환한다.
     */
    @Override
    public String toString() {
        return "SnippetSaveRequest[title=<omitted>, description=<omitted>, language=" + language
            + ", code=<omitted>, tagCount=" + (tags == null ? 0 : tags.size()) + ", favorite=" + favorite + "]";
    }
}
