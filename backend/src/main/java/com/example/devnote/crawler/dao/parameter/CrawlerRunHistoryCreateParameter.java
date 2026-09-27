package com.example.devnote.crawler.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Builder
public class CrawlerRunHistoryCreateParameter {
    @Setter
    private Long crawlerRunHistoryId;
    private Long crawlerConfigurationId;
    private String requestJson;
}
