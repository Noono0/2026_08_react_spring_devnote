package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

/**
 * 오목 한 판의 규칙입니다. (15×15 판, 흑이 먼저, 가로·세로·대각선으로 5개 이상 이으면 승리 — 금수 없는 자유 오목)
 *
 *   자리 0번 = 흑(●), 자리 1번 = 백(○). board 값: 0 빈칸, 1 흑, 2 백.
 *
 * ★ 이 클래스는 네트워크·방·사람을 모른다. "몇 번 자리가 어디에 뒀다"만 받아 규칙을 판단한다.
 *   그래서 서버 없이 단위 테스트로 규칙만 확인할 수 있다(OmokGameTest).
 */
@Getter
public class OmokGame {
    public static final int SIZE = 15;
    public static final int WIN_LENGTH = 5;
    /** 한 줄을 확인할 네 방향: 가로, 세로, 오른쪽 아래 대각선, 오른쪽 위 대각선(반대 방향은 -1을 곱해 함께 센다) */
    private static final int[][] DIRECTIONS = {{0, 1}, {1, 0}, {1, 1}, {-1, 1}};

    private final int[][] board = new int[SIZE][SIZE];
    private int turnSeat = 0;
    private Integer winnerSeat;
    private boolean draw;
    private Position lastMove;
    private List<Position> winLine = List.of();
    private int moveCount;

    public record Position(int row, int col) {}

    public boolean isFinished() {
        return winnerSeat != null || draw;
    }

    /** seat번 자리가 (row, col)에 돌을 둔다. 끝난 판·차례 아님·판 밖·이미 돌이 있으면 예외 */
    public void place(int seat, int row, int col) {
        if (isFinished()) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        if (!isInside(row, col) || board[row][col] != 0) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID);

        int stone = seat + 1;
        board[row][col] = stone;
        moveCount++;
        lastMove = new Position(row, col);

        List<Position> line = findLine(row, col, stone);
        if (line.size() >= WIN_LENGTH) {
            winnerSeat = seat;
            winLine = line;
        } else if (moveCount == SIZE * SIZE) {
            draw = true; // 판이 가득 찼는데 아무도 못 이었으면 무승부
        } else {
            turnSeat = 1 - seat;
        }
    }

    /** 기권·퇴장으로 끝낼 때: 남은 사람(winnerSeat)이 이긴다 */
    public void finishWithWinner(int seat) {
        if (isFinished()) return;
        winnerSeat = seat;
    }

    /**
     * 방금 둔 돌을 지나는 가장 긴 줄(같은 색 연속)을 찾는다.
     * 네 방향마다 "앞쪽으로 몇 개 + 뒤쪽으로 몇 개 + 자기 자신"을 센다. 판 전체를 볼 필요 없이 방금 둔 자리 주변만 보면 된다.
     */
    List<Position> findLine(int row, int col, int stone) {
        List<Position> longest = List.of(new Position(row, col));
        for (int[] direction : DIRECTIONS) {
            List<Position> line = new ArrayList<>();
            line.addAll(collect(row, col, -direction[0], -direction[1], stone).reversed());
            line.add(new Position(row, col));
            line.addAll(collect(row, col, direction[0], direction[1], stone));
            if (line.size() > longest.size()) longest = line;
        }
        return longest;
    }

    private List<Position> collect(int row, int col, int rowStep, int colStep, int stone) {
        List<Position> positions = new ArrayList<>();
        int nextRow = row + rowStep;
        int nextCol = col + colStep;
        while (isInside(nextRow, nextCol) && board[nextRow][nextCol] == stone) {
            positions.add(new Position(nextRow, nextCol));
            nextRow += rowStep;
            nextCol += colStep;
        }
        return positions;
    }

    private static boolean isInside(int row, int col) {
        return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
    }

    /** 화면에 보낼 판 복사본(밖에서 원본 배열을 고치지 못하게) */
    public int[][] copyBoard() {
        int[][] copied = new int[SIZE][];
        for (int row = 0; row < SIZE; row++) copied[row] = board[row].clone();
        return copied;
    }
}
