package com.example.devnote.crawler.dao;

import com.example.devnote.crawler.dao.parameter.CrawlerConfigurationSaveParameter;
import com.example.devnote.crawler.dao.parameter.CrawlerRunHistoryCreateParameter;
import com.example.devnote.crawler.dao.row.CrawlerConfigurationRow;
import com.example.devnote.crawler.dao.row.CrawlerRunHistoryRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class CrawlerConfigurationDaoImpl implements CrawlerConfigurationDao {
    private static final String NAMESPACE = "com.example.devnote.crawler.CrawlerConfigurationMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override public List<CrawlerConfigurationRow> selectConfigurations() { return sqlSessionTemplate.selectList(NAMESPACE + "selectConfigurations"); }
    @Override public CrawlerConfigurationRow selectConfiguration(Long configurationId) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectConfiguration", configurationId); }
    @Override public void insertConfiguration(CrawlerConfigurationSaveParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertConfiguration", parameter); }
    @Override public int updateConfiguration(CrawlerConfigurationSaveParameter parameter) { return sqlSessionTemplate.update(NAMESPACE + "updateConfiguration", parameter); }
    @Override public int deleteConfiguration(Long configurationId) { return sqlSessionTemplate.delete(NAMESPACE + "deleteConfiguration", configurationId); }
    @Override public void insertRunHistory(CrawlerRunHistoryCreateParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertRunHistory", parameter); }
    @Override public int completeRunHistorySuccess(Long historyId, String resultJson, long durationMillis, int itemCount) {
        return sqlSessionTemplate.update(NAMESPACE + "completeRunHistorySuccess", Map.of("historyId", historyId, "resultJson", resultJson, "durationMillis", durationMillis, "itemCount", itemCount));
    }
    @Override public int completeRunHistoryFailure(Long historyId, String failureStage, String failureMessage, long durationMillis) {
        return sqlSessionTemplate.update(NAMESPACE + "completeRunHistoryFailure", Map.of("historyId", historyId, "failureStage", failureStage == null ? "" : failureStage, "failureMessage", failureMessage, "durationMillis", durationMillis));
    }
    @Override public List<CrawlerRunHistoryRow> selectRunHistories(Long configurationId) { return sqlSessionTemplate.selectList(NAMESPACE + "selectRunHistories", configurationId); }
    @Override public CrawlerRunHistoryRow selectRunHistory(Long historyId) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectRunHistory", historyId); }
    @Override public int deleteRunHistory(Long historyId) { return sqlSessionTemplate.delete(NAMESPACE + "deleteRunHistory", historyId); }
}
