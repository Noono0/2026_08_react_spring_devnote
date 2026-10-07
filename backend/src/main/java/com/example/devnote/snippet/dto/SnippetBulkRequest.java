package com.example.devnote.snippet.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 일괄 삭제·복구 요청. 번호 1~100개(@NotEmpty: 빈 목록 거부). */
public record SnippetBulkRequest(
    @NotEmpty @Size(max = 100) List<@NotNull Long> snippetIds
) {
}

