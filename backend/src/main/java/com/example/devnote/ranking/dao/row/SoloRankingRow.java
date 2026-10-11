package com.example.devnote.ranking.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 혼자 하는 게임 랭킹 한 사람의 최고 기록. playedAt은 UTC */
@Getter
@Setter
public class SoloRankingRow {
    private Long memberId;
    private String playerName;
    private Integer score;
    private Integer elapsedSeconds;
    private Integer moves;
    private LocalDateTime playedAt;
}
