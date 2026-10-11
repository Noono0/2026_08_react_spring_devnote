package com.example.devnote.online.domain;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 온라인 대전에서 고를 수 있는 게임 목록입니다.
 *
 * [플레이어 자리 수]
 *   minSeats ~ maxSeats 사이에서 방장이 인원 수(seatCount)를 고른다. 오목처럼 2명만 하는 게임은 2~2.
 *   방에는 이보다 많은 사람이 들어올 수 있고, 자리에 앉지 않은 사람은 관전자다(OnlineRoom.MAX_PARTICIPANTS).
 *
 * [available]
 *   true인 게임만 방을 만들거나 바꿀 수 있다. 나머지는 화면에 "준비 중"으로 보인다.
 *   새 게임을 완성하면 여기서 true로 바꾸고 OnlineRoom에 그 게임의 진행 규칙을 연결한다.
 */
@Getter
@RequiredArgsConstructor
public enum OnlineGameType {
    OMOK("오목", 2, 2, true),
    TETRIS("테트리스 대전", 2, 4, true),
    CHESS("체스", 2, 2, false),
    BATTLESHIP("배틀십", 2, 2, false),
    NUMBER_BASEBALL("숫자 야구", 2, 4, false),
    ONE_CARD("원카드", 2, 4, false),
    MAFIA("마피아", 4, 8, false),
    MEMORY_MATCH("카드 짝 맞추기 대전", 2, 4, false),
    BLACKJACK("블랙잭", 1, 4, false),
    SUTDA("섯다", 2, 4, false),
    POKER("포커", 2, 4, false);

    private final String label;
    private final int minSeats;
    private final int maxSeats;
    private final boolean available;

    public boolean allowsSeatCount(int seatCount) {
        return seatCount >= minSeats && seatCount <= maxSeats;
    }

    /** 게임을 바꿀 때: 지금 인원 수가 새 게임 범위 밖이면 가장 가까운 값으로 맞춘다(4인 → 오목이면 2). */
    public int clampSeatCount(int seatCount) {
        return Math.max(minSeats, Math.min(maxSeats, seatCount));
    }
}
