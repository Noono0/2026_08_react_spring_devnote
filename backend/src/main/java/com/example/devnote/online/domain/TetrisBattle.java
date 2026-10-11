package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.OptionalInt;
import java.util.regex.Pattern;

/**
 * 테트리스 대전 한 판(2~4명).
 *
 * [서버 부담을 줄인 방법 — 서버는 "심판"이 아니라 "중계자"]
 *   블록이 떨어지는 계산(중력·회전·충돌)은 각자 브라우저에서 한다. 서버가 0.1초마다 모두의 판을 계산하면 부담이 크다.
 *   대신 모두가 같은 시드(seed)로 시작해 같은 순서의 블록을 받고, 서버는 아래 세 가지만 받는다.
 *     1. 블록이 굳을 때마다 내 판 요약(200글자) → 상대·관전자 화면의 작은 판
 *     2. 2줄 이상 지우면 공격 → 다음 살아 있는 상대에게 방해 줄
 *     3. 더 쌓을 곳이 없으면 탈락 → 한 명만 남으면 그 사람이 1위
 *   ★ 학습용이라 판·점수를 서버가 다시 계산해 검증하지는 않는다(조작을 막으려면 서버가 같은 규칙으로 다시 계산해야 한다).
 *
 * 공격 줄 수(일반적인 테트리스 대전 규칙): 1줄 0, 2줄 1, 3줄 2, 4줄(테트리스) 4
 */
public class TetrisBattle {
    public static final int BOARD_ROWS = 20;
    public static final int BOARD_COLS = 10;
    /** 판 요약: 보이는 20줄 × 10칸을 한 줄 글자로. "." 빈칸, I·O·T·S·Z·J·L 블록, G 방해 줄 */
    private static final Pattern BOARD_PATTERN = Pattern.compile("^[.IOTSZJLG]{" + (BOARD_ROWS * BOARD_COLS) + "}$");
    private static final int[] GARBAGE_BY_CLEARED = {0, 0, 1, 2, 4};

    private final int seed;
    /** 시작할 때의 닉네임(나간 사람도 순위 문구에 이름이 남도록) */
    private final List<String> nicknames;
    private final boolean[] alive;
    private final int[] scores;
    private final int[] lines;
    private final String[] boards;
    /** 등수(1부터). 아직 살아 있으면 0 */
    private final int[] ranks;
    private Integer winnerSeat;

    public TetrisBattle(int seed, List<String> nicknames) {
        int players = nicknames.size();
        this.seed = seed;
        this.nicknames = List.copyOf(nicknames);
        this.alive = new boolean[players];
        Arrays.fill(alive, true);
        this.scores = new int[players];
        this.lines = new int[players];
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

    /** 블록이 굳을 때 보내는 내 판·점수 */
    public void updateBoard(int seat, String board, int score, int clearedLines) {
        requireAlive(seat);
        if (board == null || !BOARD_PATTERN.matcher(board).matches() || score < 0 || clearedLines < 0) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 정보 형식이 올바르지 않습니다.");
        }
        boards[seat] = board;
        scores[seat] = score;
        lines[seat] = clearedLines;
    }

    /** 몇 줄을 지웠을 때 상대에게 보낼 방해 줄 수 */
    public static int garbageFor(int clearedLines) {
        return clearedLines >= 0 && clearedLines < GARBAGE_BY_CLEARED.length ? GARBAGE_BY_CLEARED[clearedLines] : 0;
    }

    /** 공격 받을 자리: 내 다음 자리부터 돌아가며 처음 만나는 살아 있는 사람(없으면 비어 있음) */
    public OptionalInt attackTarget(int seat) {
        requireAlive(seat);
        for (int step = 1; step < alive.length; step++) {
            int candidate = (seat + step) % alive.length;
            if (alive[candidate]) return OptionalInt.of(candidate);
        }
        return OptionalInt.empty();
    }

    /** 탈락(더 쌓을 곳이 없음·기권·퇴장). 한 명만 남으면 그 사람이 1위로 끝난다 */
    public void eliminate(int seat) {
        if (!alive[seat] || isFinished()) return;
        ranks[seat] = (int) countAlive(); // 4명 중 처음 탈락하면 4위
        alive[seat] = false;
        if (countAlive() <= 1) {
            for (int candidate = 0; candidate < alive.length; candidate++) {
                if (alive[candidate]) {
                    ranks[candidate] = 1;
                    winnerSeat = candidate;
                }
            }
            if (winnerSeat == null) winnerSeat = seat; // 혹시 모두 탈락이면 마지막에 남았던 사람
        }
    }

    /** "1위 철수 · 2위 영희" 같은 결과 문구 */
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

    public int linesOf(int seat) {
        return lines[seat];
    }

    public int rankOf(int seat) {
        return ranks[seat];
    }

    private void requireAlive(int seat) {
        if (isFinished() || seat < 0 || seat >= alive.length || !alive[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
    }
}
