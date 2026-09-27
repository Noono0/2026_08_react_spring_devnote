package com.example.devnote.crawler.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CrawlerCollectionFilterRequest(
    @NotNull(message = "키워드 그룹의 결합 방식을 선택해 주세요.")
    CrawlerMatchMode groupMatchMode,

    @NotNull(message = "키워드 그룹 목록이 필요합니다.")
    @Size(max = 10, message = "키워드 그룹은 최대 10개까지 추가할 수 있습니다.")
    List<@Valid CrawlerKeywordGroupRequest> groups
) {
    public boolean isEnabled() {
        return groups != null && !groups.isEmpty();
    }
}
