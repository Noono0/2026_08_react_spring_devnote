package com.example.devnote.crawler.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Builder
public class CrawlerConfigurationSaveParameter {
    @Setter
    private Long crawlerConfigurationId;
    private String configurationTitle;
    private String configurationDescription;
    private String sitePreset;
    private String requestJson;
}
