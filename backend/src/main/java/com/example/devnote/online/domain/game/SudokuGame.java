package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

/**
 * 스도쿠 대전(2~4명).
 *
 * [규칙]
 *   1. 시작하면 서버가 답이 하나뿐인 문제를 하나 만들어 모두에게 똑같이 준다(SudokuGenerator).
 *   2. 판은 사람마다 따로다. 차례 없이 동시에 자기 판에 숫자를 넣고(PLACE) 지운다(CLEAR).
 *      처음부터 놓인 숫자는 못 바꾼다. 틀린 숫자도 넣을 수 있고 벌점은 없다.
 *   3. 내 판이 정답 판과 같아지는 순간 그 사람이 이기고 게임이 바로 끝난다.
 *      (방 잠금 안에서 행동을 하나씩 처리하므로 "동시에 완성"은 없다. 먼저 도착한 행동이 이긴다)
 *   4. 나간 사람은 빠지고, 혼자 남으면 그 사람이 이긴다. 모두 나가면 승자 없이 끝난다.
 *
 * [무엇을 보여 주나 — viewFor]
 *   내 판은 나에게만 보낸다. 다른 사람에게는 자리마다 "채운 칸 수"만 보낸다.
 *   "맞은 칸 수"는 보내지 않는다. 숫자를 하나씩 넣어 보며 맞은 수가 늘어나는지 보면 정답을 알아낼 수 있기 때문이다.
 *   정답 판은 게임이 끝난 뒤에만 보낸다.
 *
 * 행동 모양: { action: "PLACE", numbers: [row, col], number: 1~9 } / { action: "CLEAR", numbers: [row, col] }
 */
public class SudokuGame implements OnlineGame {
    /** 처음부터 놓인 숫자 수. 적을수록 어렵다(32 = 보통) */
    public static final int GIVEN_COUNT = 32;
    private static final int SIZE = SudokuGenerator.SIZE;

    /** 자리 하나의 공개 정보: 채운 칸 수(고정 숫자 제외)와 아직 게임에 남아 있는지 */
    public record PlayerView(int filled, boolean active) {}

    /**
     * 화면 상태. 판은 9글자 문자열 9줄이고 빈 칸은 "."이다.
     * myBoard는 본인에게만(관전자는 null), solution은 끝난 뒤에만 채운다.
     */
    public record View(
        Integer mySeat, int emptyCells, List<String> givens, List<String> myBoard,
        List<PlayerView> players, List<Integer> winners, boolean finished, List<String> solution
    ) {}

    private final List<String> nicknames;
    private final int[][] givens;
    private final int[][] solution;
    private final int[][][] boards;
    private final boolean[] active;
    private final List<Integer> winners = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private boolean finished;
    private boolean completedByPlayer;

    public SudokuGame(List<String> nicknames, Random random) {
        this(nicknames, SudokuGenerator.generate(GIVEN_COUNT, random));
    }

    /** 테스트용: 정해 둔 문제로 시작한다 */
    SudokuGame(List<String> nicknames, SudokuGenerator.Puzzle puzzle) {
        this.nicknames = List.copyOf(nicknames);
        this.givens = SudokuGenerator.copy(puzzle.givens());
        this.solution = SudokuGenerator.copy(puzzle.solution());
        this.boards = new int[nicknames.size()][][];
        for (int seat = 0; seat < boards.length; seat++) boards[seat] = SudokuGenerator.copy(givens);
        this.active = new boolean[nicknames.size()];
        Arrays.fill(active, true);
    }

    @Override
    public void act(int seat, GameAction action) {
        requireActive(seat);
        switch (action.actionName()) {
            case "PLACE" -> place(seat, action.numbers(), action.number());
            case "CLEAR" -> clear(seat, action.numbers());
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void place(int seat, List<Integer> position, Integer value) {
        int[] cell = requireEditableCell(position);
        if (value == null || value < 1 || value > SIZE) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "1~9 숫자만 넣을 수 있습니다.");
        boards[seat][cell[0]][cell[1]] = value;
        if (Arrays.deepEquals(boards[seat], solution)) {
            winners.add(seat);
            completedByPlayer = true;
            announcements.add(nicknames.get(seat) + "님이 가장 먼저 완성했습니다!");
            finished = true;
        }
    }

    private void clear(int seat, List<Integer> position) {
        int[] cell = requireEditableCell(position);
        boards[seat][cell[0]][cell[1]] = 0;
    }

    @Override
    public void leave(int seat) {
        if (finished || seat < 0 || seat >= active.length || !active[seat]) return;
        active[seat] = false;
        announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
        int remaining = countActive();
        if (remaining > 1) return;
        if (remaining == 1) winners.add(firstActiveSeat());
        finished = true;
    }

    @Override
    public boolean isFinished() {
        return finished;
    }

    @Override
    public List<Integer> winnerSeats() {
        return List.copyOf(winners);
    }

    @Override
    public String resultText() {
        if (winners.isEmpty()) return "스도쿠 끝";
        String name = nicknames.get(winners.get(0));
        return completedByPlayer ? "스도쿠 " + name + " 승리 — 가장 먼저 완성" : "스도쿠 " + name + " 승리";
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean isPlayer = seat != null && seat >= 0 && seat < boards.length;
        List<PlayerView> players = new ArrayList<>();
        for (int index = 0; index < boards.length; index++) {
            players.add(new PlayerView(SudokuGenerator.countFilled(boards[index]) - SudokuGenerator.countFilled(givens), active[index]));
        }
        return new View(
            isPlayer ? seat : null, SIZE * SIZE - SudokuGenerator.countFilled(givens), rowsOf(givens),
            isPlayer ? rowsOf(boards[seat]) : null, players, List.copyOf(winners), finished, finished ? rowsOf(solution) : null
        );
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }

    /** 판 → "53..7...." 같은 9글자 문자열 9줄(화면 sudokuRules.ts가 같은 모양으로 읽는다) */
    private static List<String> rowsOf(int[][] grid) {
        List<String> rows = new ArrayList<>();
        for (int[] line : grid) {
            StringBuilder row = new StringBuilder();
            for (int value : line) row.append(value == 0 ? '.' : (char) ('0' + value));
            rows.add(row.toString());
        }
        return rows;
    }

    private int[] requireEditableCell(List<Integer> position) {
        if (position == null || position.size() != 2 || position.get(0) == null || position.get(1) == null) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 밖의 칸입니다.");
        }
        int row = position.get(0);
        int col = position.get(1);
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 밖의 칸입니다.");
        if (givens[row][col] != 0) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "처음부터 놓인 숫자는 바꿀 수 없습니다.");
        return new int[] {row, col};
    }

    private int countActive() {
        int count = 0;
        for (boolean isActive : active) if (isActive) count++;
        return count;
    }

    private int firstActiveSeat() {
        for (int index = 0; index < active.length; index++) if (active[index]) return index;
        return -1;
    }

    private void requireActive(int seat) {
        if (finished || seat < 0 || seat >= active.length || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
    }
}
