package com.example.devnote.crawler.dao;

import com.example.devnote.crawler.dao.parameter.CrawlerConfigurationSaveParameter;
import com.example.devnote.crawler.dao.parameter.CrawlerRunHistoryCreateParameter;
import com.example.devnote.crawler.dao.row.CrawlerConfigurationRow;
import com.example.devnote.crawler.dao.row.CrawlerRunHistoryRow;

import java.util.List;

/**
 * 크롤러 설정(crawler_configurations)과 실행 이력(crawler_run_histories) 접근 약속.
 * 설정의 실행 요청 전체는 JSON 한 칸(request_json)에 통째로 저장한다(단계·필드 구조가 자주 바뀌기 때문).
 */
public interface CrawlerConfigurationDao {
    List<CrawlerConfigurationRow> selectConfigurations();
    CrawlerConfigurationRow selectConfiguration(Long configurationId);
    void insertConfiguration(CrawlerConfigurationSaveParameter parameter);
    int updateConfiguration(CrawlerConfigurationSaveParameter parameter);
    int deleteConfiguration(Long configurationId);
    // 실행 시작 시 RUNNING으로 한 줄 넣고, 끝나면 completeRunHistorySuccess/Failure로 결과를 채운다.
    void insertRunHistory(CrawlerRunHistoryCreateParameter parameter);
    int completeRunHistorySuccess(Long historyId, String resultJson, long durationMillis, int itemCount);
    int completeRunHistoryFailure(Long historyId, String failureStage, String failureMessage, long durationMillis);
    List<CrawlerRunHistoryRow> selectRunHistories(Long configurationId);
    CrawlerRunHistoryRow selectRunHistory(Long historyId);
    int deleteRunHistory(Long historyId);
}
