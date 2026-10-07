package com.example.devnote.crawler.service;

import com.example.devnote.crawler.dto.CrawlerCollectionFilterRequest;
import com.example.devnote.crawler.dto.CrawlerKeywordGroupRequest;
import com.example.devnote.crawler.dto.CrawlerMatchMode;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 수집한 항목이 키워드 조건(CrawlerCollectionFilterRequest)에 맞는지 판단합니다.
 * 항목의 모든 값을 이어 붙인 글에서 키워드를 찾는다(대소문자 무시, 부분 일치).
 */
@Component
public class CrawlerItemMatcher {
    public boolean matches(Map<String, String> item, CrawlerCollectionFilterRequest collectionFilter) {
        if (!collectionFilter.isEnabled()) return true;
        String searchableText = item.entrySet().stream()
            // _pageUrl·_pageNumber처럼 _로 시작하는 값은 엔진이 붙인 내부 정보라 검색 대상에서 뺀다.
            .filter(entry -> !entry.getKey().startsWith("_"))
            .map(Map.Entry::getValue)
            .map(value -> value.toLowerCase(Locale.ROOT))
            .collect(Collectors.joining(" "));

        return combine(
            collectionFilter.groups().stream()
                .map(group -> matchesGroup(searchableText, group)),
            collectionFilter.groupMatchMode()
        );
    }

    private boolean matchesGroup(String searchableText, CrawlerKeywordGroupRequest group) {
        if (group.keywords().isEmpty()) return false;
        return combine(
            group.keywords().stream()
                .map(String::trim)
                .map(keyword -> keyword.toLowerCase(Locale.ROOT))
                .map(searchableText::contains),
            group.matchMode()
        );
    }

    /** ALL이면 모두 참이어야(allMatch), ANY면 하나만 참이어도(anyMatch) 통과. Stream은 결과가 정해지면 나머지 계산을 멈춘다. */
    private boolean combine(Stream<Boolean> matches, CrawlerMatchMode matchMode) {
        return matchMode == CrawlerMatchMode.ALL
            ? matches.allMatch(Boolean::booleanValue)
            : matches.anyMatch(Boolean::booleanValue);
    }
}
