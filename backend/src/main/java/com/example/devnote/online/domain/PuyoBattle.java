package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.OptionalInt;
import java.util.regex.Pattern;

/**
 * 뿌요뿌요 대전 한 판(2~6명).
 *
 * 테트리스 대전과 같은 "중계자" 방식이다. 떨어지는 계산은 각자 브라우저(puyoLogic.ts)가 하고,
 * 서버는 같은 시드·판 요약(72글자)·공격(방해 개수)·탈락만 다룬다.
 * 학습용이라 판·점수를 서버가 다시 계산해 검증하지는 않는다.
 */
public class PuyoBattle {
    public static final int BOARD_ROWS = 12;
    public static final int BOARD_COLS = 6;
    /** 판 요약: 보이는 12줄 × 6칸. "." 빈칸, R·G·B·Y·P 색, N 방해 뿌요 */
    private static final Pattern BOARD_PATTERN = Pattern.compile("^[.RGBYPN]{" + (BOARD_ROWS * BOARD_COLS) + "}$");
    private static final int MAX_NUISANCE = 30;

    private final int seed;
    private final List<String> nicknames;
    private final boolean[] alive;
    private final int[] scores;
    private final int[] chains;
    private final String[] boards;
    private final int[] ranks;
    private Integer winnerSeat;

    public PuyoBattle(int seed, List<String> nicknames) {
        int players = nicknames.size();
        this.seed = seed;
        this.nicknames = List.copyOf(nicknames);
        this.alive = new boolean[players];
        Arrays.fill(alive, true);
        this.scores = new int[players];
        this.chains = new int[players];
        this.boards = new String[players];
        Arrays.fill(boards, ".".repeat(BOARD_ROWS * BOARD_COLS));
        this.ranks = new int[players];
    }

    public List<String> getNicknames() {
        return nicknames;
    }

    public int getSeed() {
        return seed;
    }

    public Integer getWinnerSeat() {
        return winnerSeat;
    }

    public int getPlayerCount() {
        return alive.length;
    }

    public boolean isAlive(int seat) {
        return alive[seat];
    }

    public boolean isFinished() {
        return winnerSeat != null;
    }

    public long countAlive() {
        int count = 0;
        for (boolean isAlive : alive) if (isAlive) count++;
        return count;
    }

    public void updateBoard(int seat, String board, int score, int chainCount) {
        requireAlive(seat);
        if (board == null || !BOARD_PATTERN.matcher(board).matches() || score < 0 || chainCount < 0) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 정보 형식이 올바르지 않습니다.");
        }
        boards[seat] = board;
        scores[seat] = score;
        chains[seat] = chainCount;
    }

    /** 브라우저가 계산한 방해 개수(1~30)만 받는다. 범위를 벗어나면 공격을 무시한다 */
    public static int garbageFor(int nuisance) {
        return nuisance >= 1 && nuisance <= MAX_NUISANCE ? nuisance : 0;
    }

    public OptionalInt attackTarget(int seat) {
        requireAlive(seat);
        for (int step = 1; step < alive.length; step++) {
            int candidate = (seat + step) % alive.length;
            if (alive[candidate]) return OptionalInt.of(candidate);
        }
        return OptionalInt.empty();
    }

    public void eliminate(int seat) {
        if (!alive[seat] || isFinished()) return;
        ranks[seat] = (int) countAlive();
        alive[seat] = false;
        if (countAlive() <= 1) {
            for (int candidate = 0; candidate < alive.length; candidate++) {
                if (alive[candidate]) {
                    ranks[candidate] = 1;
                    winnerSeat = candidate;
                }
            }
            if (winnerSeat == null) winnerSeat = seat;
        }
    }

    public String describeResult() {
        List<String> parts = new ArrayList<>();
        for (int rank = 1; rank <= alive.length; rank++) {
            for (int seat = 0; seat < ranks.length; seat++) {
                if (ranks[seat] == rank) parts.add(rank + "위 " + nicknames.get(seat));
            }
        }
        return String.join(" · ", parts);
    }

    public String boardOf(int seat) {
        return boards[seat];
    }

    public int scoreOf(int seat) {
        return scores[seat];
    }

    public int chainsOf(int seat) {
        return chains[seat];
    }

    public int rankOf(int seat) {
        return ranks[seat];
    }

    private void requireAlive(int seat) {
        if (isFinished() || seat < 0 || seat >= alive.length || !alive[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
    }
}
