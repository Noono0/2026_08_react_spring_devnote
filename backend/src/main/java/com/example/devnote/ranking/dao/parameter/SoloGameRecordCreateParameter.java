package com.example.devnote.ranking.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * solo_game_records INSERT용 값. soloGameRecordId는 INSERT 후 MyBatis가 채운다(useGeneratedKeys).
 * 게임에서 쓰지 않는 값(score·elapsedSeconds·moves)은 null로 둔다. playedAt은 UTC
 */
@Getter
@Setter
@Builder
public class SoloGameRecordCreateParameter {
    private Long soloGameRecordId;
    private String gameCode;
    private String difficulty;
    private Long memberId;
    private String nickname;
    private Integer score;
    private Integer elapsedSeconds;
    private Integer moves;
    private LocalDateTime playedAt;
}
