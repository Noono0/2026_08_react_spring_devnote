package com.example.devnote.crawler.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/** 크롤러 설정 저장용 값. requestJson = 로그인 아이디·비밀번호를 지운 실행 요청 JSON. 번호는 INSERT 후 채워진다. */
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
