package com.example.devnote.crawler.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 키워드 그룹 하나. matchMode = ALL(모두 포함) / ANY(하나라도 포함), 키워드 1~20개. */
public record CrawlerKeywordGroupRequest(
    @NotNull(message = "키워드 그룹의 결합 방식을 선택해 주세요.")
    CrawlerMatchMode matchMode,

    @NotEmpty(message = "키워드 그룹에 키워드를 한 개 이상 입력해 주세요.")
    @Size(max = 20, message = "한 그룹에는 키워드를 최대 20개까지 입력할 수 있습니다.")
    List<@NotBlank(message = "빈 키워드는 사용할 수 없습니다.")
        @Size(max = 100, message = "키워드는 100자 이하여야 합니다.") String> keywords
) {
}
