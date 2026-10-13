package com.example.devnote.online.dto;

import java.util.List;

/**
 * 오목 판 상태. board[row][col]: 0 빈칸, 1 흑(0번 자리), 2 백(1번 자리)
 * winnerSeat: 이긴 자리(없으면 null), winLine: 이긴 다섯 줄 위치(화면에서 강조)
 */
public record OmokView(
    int[][] board,
    int turnSeat,
    Integer winnerSeat,
    boolean draw,
    OmokPositionView lastMove,
    List<OmokPositionView> winLine
) {
    public record OmokPositionView(int row, int col) {}
}
