package com.example.devnote.crawler.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/** 실행 이력 시작 행 INSERT용 값. 만들어진 이력 번호(crawlerRunHistoryId)로 실행이 끝난 뒤 결과를 갱신한다. */
@Getter
@Builder
public class CrawlerRunHistoryCreateParameter {
    @Setter
    private Long crawlerRunHistoryId;
    private Long crawlerConfigurationId;
    private String requestJson;
}
