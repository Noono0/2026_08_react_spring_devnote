package com.example.devnote.crawler.dao;

import com.example.devnote.crawler.dao.parameter.CrawlerConfigurationSaveParameter;
import com.example.devnote.crawler.dao.parameter.CrawlerRunHistoryCreateParameter;
import com.example.devnote.crawler.dao.row.CrawlerConfigurationRow;
import com.example.devnote.crawler.dao.row.CrawlerRunHistoryRow;

import java.util.List;

public interface CrawlerConfigurationDao {
    List<CrawlerConfigurationRow> selectConfigurations();
    CrawlerConfigurationRow selectConfiguration(Long configurationId);
    void insertConfiguration(CrawlerConfigurationSaveParameter parameter);
    int updateConfiguration(CrawlerConfigurationSaveParameter parameter);
    int deleteConfiguration(Long configurationId);
    void insertRunHistory(CrawlerRunHistoryCreateParameter parameter);
    int completeRunHistorySuccess(Long historyId, String resultJson, long durationMillis, int itemCount);
    int completeRunHistoryFailure(Long historyId, String failureStage, String failureMessage, long durationMillis);
    List<CrawlerRunHistoryRow> selectRunHistories(Long configurationId);
    CrawlerRunHistoryRow selectRunHistory(Long historyId);
    int deleteRunHistory(Long historyId);
}
