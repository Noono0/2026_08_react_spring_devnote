package com.example.devnote.crawler.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 수집한 항목을 키워드로 거르는 조건. 그룹 여러 개를 groupMatchMode로 묶는다.
 *   예) 그룹A(ALL: "React","채용") + 그룹B(ANY: "서울","원격"), groupMatchMode=ALL
 *       → "React와 채용을 모두 포함"하면서 "서울 또는 원격을 포함"하는 항목만 남긴다.
 * 그룹이 비어 있으면 거르지 않는다(isEnabled = false). 실제 판단은 CrawlerItemMatcher가 한다.
 */
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
