package com.example.devnote.ranking.dao;

import com.example.devnote.ranking.dao.parameter.GameRankingQueryParameter;
import com.example.devnote.ranking.dao.parameter.OnlineGameResultCreateParameter;
import com.example.devnote.ranking.dao.parameter.SoloGameRecordCreateParameter;
import com.example.devnote.ranking.dao.row.OnlineRankingRow;
import com.example.devnote.ranking.dao.row.SoloRankingRow;

import java.time.LocalDateTime;
import java.util.List;

/** 게임 랭킹 저장소. SQL은 mybatis/mapper/ranking/GameRankingMapper.xml */
public interface GameRankingDao {
    void insertOnlineGameResult(OnlineGameResultCreateParameter parameter);

    void insertSoloGameRecord(SoloGameRecordCreateParameter parameter);

    List<OnlineRankingRow> selectOnlineRanking(GameRankingQueryParameter parameter);

    List<SoloRankingRow> selectSoloRanking(GameRankingQueryParameter parameter);

    /** cutoff(UTC)보다 오래된 비회원 기록만 지운다. 지운 줄 수를 돌려준다 */
    int deleteGuestOnlineResultsBefore(LocalDateTime cutoff);

    int deleteGuestSoloRecordsBefore(LocalDateTime cutoff);
}
