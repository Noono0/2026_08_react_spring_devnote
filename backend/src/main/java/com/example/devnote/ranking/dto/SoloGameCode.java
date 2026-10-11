package com.example.devnote.ranking.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.List;

/**
 * 랭킹을 매기는 혼자 하는 게임과 "좋은 기록"의 기준입니다.
 *
 *   2048·테트리스  : 점수가 높을수록 좋다(SCORE_DESC). 난이도 없음
 *   지뢰 찾기      : 이긴 시간이 짧을수록 좋다(TIME_ASC). 난이도마다 따로 매긴다
 *   카드 짝 맞추기 : 시도가 적을수록, 같으면 시간이 짧을수록 좋다(MOVES_THEN_TIME_ASC). 난이도마다 따로
 *   스도쿠         : 다 푼 시간이 짧을수록 좋다(TIME_ASC). 난이도마다 따로
 *
 * 난이도 이름은 화면(minesweeperLogic.ts·memoryLogic.ts·sudokuLogic.ts)의 값과 같아야 한다.
 */
@Getter
@RequiredArgsConstructor
public enum SoloGameCode {
    GAME_2048(RankingOrder.SCORE_DESC, List.of()),
    TETRIS(RankingOrder.SCORE_DESC, List.of()),
    MINESWEEPER(RankingOrder.TIME_ASC, List.of("BEGINNER", "INTERMEDIATE", "EXPERT")),
    MEMORY(RankingOrder.MOVES_THEN_TIME_ASC, List.of("EASY", "NORMAL", "HARD")),
    SUDOKU(RankingOrder.TIME_ASC, List.of("EASY", "NORMAL", "HARD"));

    /** 기록을 줄 세우는 기준. Mapper XML의 soloRecordOrder가 이 이름으로 ORDER BY를 고른다 */
    public enum RankingOrder { SCORE_DESC, TIME_ASC, MOVES_THEN_TIME_ASC }

    private final RankingOrder rankingOrder;
    private final List<String> difficulties;

    /** 난이도가 없는 게임은 빈 문자열만, 있는 게임은 목록 안의 값만 받는다 */
    public boolean allowsDifficulty(String difficulty) {
        return difficulties.isEmpty() ? difficulty.isEmpty() : difficulties.contains(difficulty);
    }
}
