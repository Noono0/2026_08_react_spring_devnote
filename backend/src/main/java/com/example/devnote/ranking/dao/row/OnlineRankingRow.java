package com.example.devnote.ranking.dao.row;

import lombok.Getter;
import lombok.Setter;

/** 온라인 대전 랭킹 한 사람의 집계(승수·판 수). memberId가 null이면 비회원 닉네임 묶음 */
@Getter
@Setter
public class OnlineRankingRow {
    private Long memberId;
    private String playerName;
    private int wins;
    private int plays;
}
