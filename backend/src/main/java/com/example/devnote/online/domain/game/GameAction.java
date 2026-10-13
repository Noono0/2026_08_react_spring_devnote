package com.example.devnote.online.domain.game;

import java.util.List;

/**
 * 게임 행동 하나. action으로 종류를 나누고, 필요한 칸만 채운다(게임마다 쓰는 칸이 다르다).
 *   숫자 야구 : { action: "SET_SECRET", text: "382" } / { action: "GUESS", text: "195" }
 *   배틀십    : { action: "FIRE", numbers: [row, col] }
 *   카드 게임 : { action: "PLAY", number: 카드 번호 } 등
 */
public record GameAction(String action, String text, Integer number, List<Integer> numbers) {
    public String actionName() {
        return action == null ? "" : action;
    }
}
