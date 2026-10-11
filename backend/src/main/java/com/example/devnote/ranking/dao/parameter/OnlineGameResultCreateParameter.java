package com.example.devnote.ranking.dao.parameter;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/** online_game_results INSERT용 값(한 판의 플레이어 한 명). memberId는 비회원이면 null, playedAt은 UTC */
@Getter
@Builder
public class OnlineGameResultCreateParameter {
    private String gameType;
    private Long memberId;
    private String nickname;
    private int playerCount;
    private boolean won;
    private LocalDateTime playedAt;
}
