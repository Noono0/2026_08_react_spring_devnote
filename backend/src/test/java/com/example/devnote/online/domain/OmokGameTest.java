package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OmokGameTest {
    /** 흑은 (row, 0..4)처럼 원하는 자리에, 백은 위쪽 줄(0번 줄)에 아무렇게나 두며 번갈아 진행한다 */
    private static void playBlack(OmokGame game, int[][] blackMoves) {
        int whiteCol = 0;
        for (int index = 0; index < blackMoves.length; index++) {
            game.place(0, blackMoves[index][0], blackMoves[index][1]);
            if (game.isFinished()) return;
            game.place(1, 0, whiteCol++);
        }
    }

    @Test
    void 가로_다섯개면_흑이_이기고_이긴_줄을_기억한다() {
        OmokGame game = new OmokGame();
        playBlack(game, new int[][] {{7, 3}, {7, 4}, {7, 6}, {7, 7}, {7, 5}}); // 가운데를 마지막에 채워도 이어진다
        assertThat(game.getWinnerSeat()).isEqualTo(0);
        assertThat(game.getWinLine()).hasSize(5).extracting(OmokGame.Position::col).containsExactly(3, 4, 5, 6, 7);
    }

    @Test
    void 세로와_두_대각선도_다섯개면_이긴다() {
        OmokGame vertical = new OmokGame();
        playBlack(vertical, new int[][] {{3, 9}, {4, 9}, {5, 9}, {6, 9}, {7, 9}});
        assertThat(vertical.getWinnerSeat()).isZero();

        OmokGame diagonal = new OmokGame();
        playBlack(diagonal, new int[][] {{3, 3}, {4, 4}, {5, 5}, {6, 6}, {7, 7}});
        assertThat(diagonal.getWinnerSeat()).isZero();

        OmokGame antiDiagonal = new OmokGame();
        playBlack(antiDiagonal, new int[][] {{9, 3}, {8, 4}, {7, 5}, {6, 6}, {5, 7}});
        assertThat(antiDiagonal.getWinnerSeat()).isZero();
    }

    @Test
    void 네개는_아직_이기지_않고_차례가_넘어간다() {
        OmokGame game = new OmokGame();
        playBlack(game, new int[][] {{7, 3}, {7, 4}, {7, 5}, {7, 6}});
        assertThat(game.isFinished()).isFalse();
        assertThat(game.getTurnSeat()).isZero(); // 흑 4번·백 4번 뒤 흑 차례
    }

    @Test
    void 판_끝에서도_줄을_정확히_센다() {
        OmokGame game = new OmokGame();
        playBlack(game, new int[][] {{14, 10}, {14, 11}, {14, 12}, {14, 13}, {14, 14}});
        assertThat(game.getWinnerSeat()).isZero();
    }

    @Test
    void 차례가_아니거나_이미_돌이_있거나_판_밖이면_둘_수_없다() {
        OmokGame game = new OmokGame();
        assertThatThrownBy(() -> game.place(1, 7, 7)).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        game.place(0, 7, 7);
        assertThatThrownBy(() -> game.place(1, 7, 7)).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MOVE_INVALID));
        assertThatThrownBy(() -> game.place(1, 15, 0)).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MOVE_INVALID));
    }

    @Test
    void 끝난_판에는_더_둘_수_없고_화면용_판은_복사본이다() {
        OmokGame game = new OmokGame();
        playBlack(game, new int[][] {{7, 3}, {7, 4}, {7, 5}, {7, 6}, {7, 7}});
        assertThatThrownBy(() -> game.place(1, 10, 10)).isInstanceOf(BusinessException.class);
        int[][] copied = game.copyBoard();
        copied[7][3] = 0;
        assertThat(game.getBoard()[7][3]).isEqualTo(1);
    }
}
