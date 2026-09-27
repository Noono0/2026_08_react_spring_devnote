package com.example.devnote.crawler.service;

import com.example.devnote.crawler.dto.CrawlerCollectionFilterRequest;
import com.example.devnote.crawler.dto.CrawlerKeywordGroupRequest;
import com.example.devnote.crawler.dto.CrawlerMatchMode;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Component
public class CrawlerItemMatcher {
    public boolean matches(Map<String, String> item, CrawlerCollectionFilterRequest collectionFilter) {
        if (!collectionFilter.isEnabled()) return true;
        String searchableText = item.entrySet().stream()
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

    private boolean combine(Stream<Boolean> matches, CrawlerMatchMode matchMode) {
        return matchMode == CrawlerMatchMode.ALL
            ? matches.allMatch(Boolean::booleanValue)
            : matches.anyMatch(Boolean::booleanValue);
    }
}
