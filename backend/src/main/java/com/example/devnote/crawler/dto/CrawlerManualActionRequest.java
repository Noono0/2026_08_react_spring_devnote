package com.example.devnote.crawler.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CrawlerManualActionRequest(
    @NotNull(message = "수동 조작 종류를 선택해 주세요.")
    CrawlerManualActionType action,
    Double x,
    Double y,
    @Size(max = 500, message = "한 번에 입력할 글자는 500자 이하여야 합니다.")
    String text
) {
}
