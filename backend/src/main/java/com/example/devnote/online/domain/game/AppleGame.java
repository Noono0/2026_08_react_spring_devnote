package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

/**
 * 사과게임 대전(2~4명). 모두 같은 17칸 × 10줄 사과판(숫자 1~9)을 각자 자기 판에서 동시에 푼다.
 *
 * [고르기] SELECT numbers = [줄1, 칸1, 줄2, 칸2] — 두 칸으로 만든 사각형 안에 남은 사과 숫자 합이 딱 10이면
 *   그 사과들이 사라지고 사라진 개수만큼 점수를 얻는다. 10이 아니면 아무 일도 없다(오류로 보지 않는다. 끌다가 놓친 것이므로).
 * [시간] 2분. 서버가 1초마다 tick(now)을 부르고, 시작 뒤 첫 tick에서 마감 시각을 정한다(캐치마인드와 같은 방식).
 *   누군가 사과를 모두 없애도 바로 끝난다.
 * [승패] 끝났을 때 점수가 가장 높은 사람(공동 가능). 모두 0점이면 무승부.
 *
 * ★ 점수는 서버가 판정한다. 각자의 판을 서버가 들고 있으므로 화면이 "몇 점 땄다"고 보내도 믿지 않는다.
 *   (혼자 연습은 브라우저가 계산 — frontend appleLogic.ts가 같은 규칙)
 */
public class AppleGame implements OnlineGame {
    public static final int ROWS = 10;
    public static final int COLUMNS = 17;
    public static final int TARGET_SUM = 10;
    public static final long TIME_LIMIT_MILLIS = 120_000;

    /**
     * myBoard: 내 판 10줄 × 17글자(숫자 1~9, 없앤 자리 '0'). 관전자는 빈 목록
     * remaining: 자리마다 남은 사과 수(남의 판 모양은 보내지 않는다)
     */
    public record View(Integer mySeat, List<String> myBoard, List<Integer> scores, List<Integer> remaining, List<Boolean> active,
                       Long deadline, List<String> log, List<Integer> winnerSeats, boolean finished) {}

    private final List<String> nicknames;
    private final int[][][] boards;
    private final int[] scores;
    private final boolean[] active;
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Long deadline;
    private boolean finished;

    public AppleGame(List<String> nicknames, Random random) {
        this(nicknames, randomBoard(random));
    }

    /** 테스트용: 판을 정해서 시작한다(모두 같은 판의 복사본을 받는다) */
    AppleGame(List<String> nicknames, int[][] board) {
        if (nicknames.size() < 2 || nicknames.size() > 4) throw new IllegalArgumentException("사과게임 대전은 2~4명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        this.boards = new int[nicknames.size()][][];
        for (int seat = 0; seat < boards.length; seat++) {
            boards[seat] = Arrays.stream(board).map(int[]::clone).toArray(int[][]::new);
        }
        this.scores = new int[nicknames.size()];
        this.active = new boolean[nicknames.size()];
        Arrays.fill(active, true);
        say("사과게임 시작! 모두 같은 판입니다. 2분 동안 합이 10이 되게 사과를 골라 없애세요.");
    }

    private static int[][] randomBoard(Random random) {
        int[][] board = new int[ROWS][COLUMNS];
        for (int[] row : board) for (int col = 0; col < COLUMNS; col++) row[col] = 1 + random.nextInt(9);
        return board;
    }

    private void say(String text) {
        announcements.add(text);
        log.add(text);
        if (log.size() > 20) log.remove(0);
    }

    // ── 진행 ─────────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= boards.length) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (!active[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "나간 플레이어는 할 수 없습니다.");
        if (!action.actionName().equals("SELECT")) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        List<Integer> numbers = action.numbers();
        if (numbers == null || numbers.size() != 4 || numbers.stream().anyMatch(java.util.Objects::isNull)) {
            throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
        int top = Math.min(numbers.get(0), numbers.get(2));
        int bottom = Math.max(numbers.get(0), numbers.get(2));
        int left = Math.min(numbers.get(1), numbers.get(3));
        int right = Math.max(numbers.get(1), numbers.get(3));
        if (top < 0 || bottom >= ROWS || left < 0 || right >= COLUMNS) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 밖입니다.");
        select(seat, top, left, bottom, right);
    }

    private void select(int seat, int top, int left, int bottom, int right) {
        int[][] board = boards[seat];
        int sum = 0;
        int count = 0;
        for (int row = top; row <= bottom; row++) {
            for (int col = left; col <= right; col++) {
                if (board[row][col] > 0) {
                    sum += board[row][col];
                    count++;
                }
            }
        }
        if (sum != TARGET_SUM || count == 0) return; // 합이 10이 아니면 그대로(끌다가 놓친 것)
        for (int row = top; row <= bottom; row++) for (int col = left; col <= right; col++) board[row][col] = 0;
        scores[seat] += count;
        if (remaining(seat) == 0) {
            say(nicknames.get(seat) + " 님이 사과를 모두 없앴습니다!");
            finish();
        }
    }

    @Override
    public boolean tick(long nowMillis) {
        if (finished) return false;
        if (deadline == null) {
            deadline = nowMillis + TIME_LIMIT_MILLIS;
            return true;
        }
        if (nowMillis < deadline) return false;
        say("시간 끝!");
        finish();
        return true;
    }

    private int remaining(int seat) {
        int count = 0;
        for (int[] row : boards[seat]) for (int value : row) if (value > 0) count++;
        return count;
    }

    private void finish() {
        finished = true;
        List<String> parts = new ArrayList<>();
        for (int seat = 0; seat < scores.length; seat++) parts.add(nicknames.get(seat) + " " + scores[seat] + "개");
        say("결과: " + String.join(", ", parts));
    }

    @Override
    public void leave(int seat) {
        if (finished || seat < 0 || seat >= boards.length || !active[seat]) return;
        active[seat] = false;
        say(nicknames.get(seat) + " 님이 나갔습니다.");
        long left = 0;
        for (boolean value : active) if (value) left++;
        if (left <= 1) finish();
    }

    @Override
    public boolean isFinished() {
        return finished;
    }

    /** 남아 있는 사람 중 최고 점수(공동 가능). 모두 0점이면 무승부 */
    @Override
    public List<Integer> winnerSeats() {
        if (!finished) return List.of();
        int top = 0;
        for (int seat = 0; seat < scores.length; seat++) if (active[seat]) top = Math.max(top, scores[seat]);
        if (top == 0) return List.of();
        List<Integer> winners = new ArrayList<>();
        for (int seat = 0; seat < scores.length; seat++) if (active[seat] && scores[seat] == top) winners.add(seat);
        return List.copyOf(winners);
    }

    @Override
    public String resultText() {
        List<Integer> winners = winnerSeats();
        if (winners.isEmpty()) return "사과게임 무승부";
        List<String> names = winners.stream().map(nicknames::get).toList();
        return "사과게임 " + String.join(" · ", names) + (names.size() > 1 ? " 공동 승리" : " 승리") + " (" + scores[winners.get(0)] + "개)";
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean player = seat != null && seat >= 0 && seat < boards.length;
        List<String> myBoard = new ArrayList<>();
        if (player) {
            for (int[] row : boards[seat]) {
                StringBuilder line = new StringBuilder();
                for (int value : row) line.append(value);
                myBoard.add(line.toString());
            }
        }
        List<Integer> remainingList = new ArrayList<>();
        List<Boolean> activeList = new ArrayList<>();
        for (int index = 0; index < boards.length; index++) {
            remainingList.add(remaining(index));
            activeList.add(active[index]);
        }
        return new View(player ? seat : null, myBoard, Arrays.stream(scores).boxed().toList(), remainingList, activeList,
            finished ? null : deadline, List.copyOf(log), winnerSeats(), finished);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
