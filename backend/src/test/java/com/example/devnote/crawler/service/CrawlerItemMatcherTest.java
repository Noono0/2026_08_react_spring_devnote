package com.example.devnote.crawler.service;

import com.example.devnote.crawler.dto.CrawlerCollectionFilterRequest;
import com.example.devnote.crawler.dto.CrawlerKeywordGroupRequest;
import com.example.devnote.crawler.dto.CrawlerMatchMode;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CrawlerItemMatcherTest {
    private final CrawlerItemMatcher matcher = new CrawlerItemMatcher();

    @Test
    void matchesNestedAndOrKeywordGroupsWithoutHardcodedTerms() {
        Map<String, String> item = Map.of("제목", "공공임대 2호선 신림 인근 매물", "설명", "보증금 정보");
        CrawlerCollectionFilterRequest filter = filter(
            CrawlerMatchMode.ALL,
            group(CrawlerMatchMode.ALL, "공공임대", "2호선"),
            group(CrawlerMatchMode.ANY, "신림", "봉천", "강남")
        );

        assertThat(matcher.matches(item, filter)).isTrue();
    }

    @Test
    void rejectsItemWhenRequiredGroupDoesNotMatch() {
        Map<String, String> item = Map.of("제목", "공공임대 2호선 신림 인근 매물");
        CrawlerCollectionFilterRequest filter = filter(
            CrawlerMatchMode.ALL,
            group(CrawlerMatchMode.ALL, "공공임대"),
            group(CrawlerMatchMode.ANY, "잠실", "성수")
        );

        assertThat(matcher.matches(item, filter)).isFalse();
    }

    @Test
    void ignoresCrawlerMetadataAndAcceptsEmptyFilter() {
        Map<String, String> item = new LinkedHashMap<>();
        item.put("제목", "일반 게시글");
        item.put("_pageUrl", "https://example.com/hidden-keyword");

        assertThat(matcher.matches(item, filter(
            CrawlerMatchMode.ALL,
            group(CrawlerMatchMode.ANY, "hidden-keyword")
        ))).isFalse();
        assertThat(matcher.matches(item, new CrawlerCollectionFilterRequest(CrawlerMatchMode.ALL, List.of())))
            .isTrue();
    }

    private CrawlerCollectionFilterRequest filter(
        CrawlerMatchMode groupMatchMode,
        CrawlerKeywordGroupRequest... groups
    ) {
        return new CrawlerCollectionFilterRequest(groupMatchMode, List.of(groups));
    }

    private CrawlerKeywordGroupRequest group(CrawlerMatchMode matchMode, String... keywords) {
        return new CrawlerKeywordGroupRequest(matchMode, List.of(keywords));
    }
}
