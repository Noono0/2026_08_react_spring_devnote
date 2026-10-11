package com.example.devnote.ranking.dto;

/** 등록한 기록. playerName은 랭킹에 보일 이름(회원이면 회원 이름) */
public record SoloGameRecordResponse(Long soloGameRecordId, String playerName, boolean member) {
}
