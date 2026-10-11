package com.example.devnote.ranking.dao;

import com.example.devnote.ranking.dao.parameter.GameRankingQueryParameter;
import com.example.devnote.ranking.dao.parameter.OnlineGameResultCreateParameter;
import com.example.devnote.ranking.dao.parameter.SoloGameRecordCreateParameter;
import com.example.devnote.ranking.dao.row.OnlineRankingRow;
import com.example.devnote.ranking.dao.row.SoloRankingRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/** GameRankingDao의 MyBatis 구현. GameRankingMapper.xml의 같은 id SQL을 실행한다. */
@Repository
@RequiredArgsConstructor
public class GameRankingDaoImpl implements GameRankingDao {
    private static final String NAMESPACE = "com.example.devnote.ranking.GameRankingMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override public void insertOnlineGameResult(OnlineGameResultCreateParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertOnlineGameResult", parameter); }
    @Override public void insertSoloGameRecord(SoloGameRecordCreateParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertSoloGameRecord", parameter); }
    @Override public List<OnlineRankingRow> selectOnlineRanking(GameRankingQueryParameter parameter) { return sqlSessionTemplate.selectList(NAMESPACE + "selectOnlineRanking", parameter); }
    @Override public List<SoloRankingRow> selectSoloRanking(GameRankingQueryParameter parameter) { return sqlSessionTemplate.selectList(NAMESPACE + "selectSoloRanking", parameter); }
    @Override public int deleteGuestOnlineResultsBefore(LocalDateTime cutoff) { return sqlSessionTemplate.delete(NAMESPACE + "deleteGuestOnlineResultsBefore", cutoff); }
    @Override public int deleteGuestSoloRecordsBefore(LocalDateTime cutoff) { return sqlSessionTemplate.delete(NAMESPACE + "deleteGuestSoloRecordsBefore", cutoff); }
}
