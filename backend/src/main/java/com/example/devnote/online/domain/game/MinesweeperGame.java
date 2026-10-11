package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Random;

/**
 * 지뢰 찾기 대전(2~4명). 모두 같은 지뢰 배치를 각자 자기 판에서 동시에 푼다(차례 없음).
 *
 * [규칙] 혼자 하는 지뢰 찾기(minesweeperLogic.ts)와 같다.
 *   REVEAL: 닫힌 칸을 연다. 주변 지뢰가 0인 칸이면 이웃으로 계속 넓힌다(BFS, 큐로 반복).
 *   FLAG  : 닫힌 칸에 깃발을 꽂거나 뺀다. 깃발 칸은 열리지 않는다.
 *   CHORD : 열린 숫자 칸 주변의 깃발 수가 그 숫자와 같으면 나머지 닫힌 이웃을 한꺼번에 연다.
 *   지뢰를 열면 실패(판이 멈춘다), 지뢰가 아닌 칸을 모두 열면 성공.
 *
 * [공정한 첫 수] 서버가 한 칸을 골라 그 칸과 이웃을 피해 지뢰를 놓는다 → 그 칸은 주변 지뢰가 0이다.
 *   시작할 때 모든 판에서 그 칸(과 연쇄로 열리는 빈 영역)을 똑같이 미리 열어 준다.
 *
 * [클릭 수] 판을 실제로 바꾼 REVEAL·CHORD만 센다(깃발·이미 연 칸 누르기는 안 센다).
 * [끝과 순위] RaceStandings 참고(성공은 적은 클릭 수 → 먼저 끝낸 순, 실패는 많이 연 칸 순).
 *
 * [숨긴 정보 — viewFor]
 *   지뢰 위치는 게임이 끝나기 전에는 아무에게도 보내지 않는다(내 판·남의 판·관전자 모두). 밟은 칸도 끝난 뒤에 공개한다.
 *   판 한 줄은 칸마다 한 글자: "." 닫힘, "F" 깃발, "0"~"8" 연 칸의 주변 지뢰 수.
 *   끝난 뒤에만 "*" 지뢰, "X" 밟은 지뢰, "W" 지뢰가 아닌 곳의 깃발이 더해진다.
 *
 * 행동 모양: { action: "REVEAL" | "FLAG" | "CHORD", numbers: [row, col] }
 */
public class MinesweeperGame implements OnlineGame {
    /** 난이도별 판 크기·지뢰 수(혼자 하기 minesweeperDifficulties와 같다) */
    public enum Difficulty {
        BEGINNER("초급", 9, 9, 10),
        INTERMEDIATE("중급", 16, 16, 40),
        EXPERT("고급", 16, 30, 99);

        private final String label;
        private final int rows;
        private final int cols;
        private final int mines;

        Difficulty(String label, int rows, int cols, int mines) {
            this.label = label;
            this.rows = rows;
            this.cols = cols;
            this.mines = mines;
        }
    }

    private enum CellState { HIDDEN, REVEALED, FLAGGED }

    /** 자리 하나의 공개 정보. revealed = 연 안전 칸 수, status: PLAYING·SUCCESS·FAILED·LEFT, rank는 끝난 뒤에만 */
    public record PlayerView(String nickname, List<String> board, int clicks, int revealed, int flags, String status, Integer finishOrder, Integer rank) {}

    public record View(Integer mySeat, String difficulty, int rows, int cols, int mines, int safeCells,
                       List<PlayerView> players, List<Integer> winners, boolean finished) {}

    private final List<String> nicknames;
    private final Difficulty difficulty;
    private final int rows;
    private final int cols;
    private final boolean[][] mines;
    private final int[][] adjacent;
    private final CellState[][][] boards;
    private final int[] clicks;
    private final int[][] explodedAt;
    private final RaceStandings standings;
    private final List<String> announcements = new ArrayList<>();

    public MinesweeperGame(List<String> nicknames, Random random, Difficulty difficulty) {
        this(nicknames, difficulty, createLayout(difficulty, random));
    }

    /** 지뢰 배치와 미리 열 칸 */
    record Layout(boolean[][] mines, int startRow, int startCol) {}

    /** 테스트용: 지뢰 배치를 직접 정한다(start 칸은 주변 지뢰가 0이어야 한다) */
    MinesweeperGame(List<String> nicknames, Difficulty difficulty, Layout layout) {
        this.nicknames = List.copyOf(nicknames);
        this.difficulty = difficulty;
        this.rows = layout.mines().length;
        this.cols = layout.mines()[0].length;
        this.mines = layout.mines();
        this.adjacent = countAdjacent(mines);
        int seatCount = nicknames.size();
        this.boards = new CellState[seatCount][rows][cols];
        for (int seat = 0; seat < seatCount; seat++) {
            for (CellState[] row : boards[seat]) Arrays.fill(row, CellState.HIDDEN);
            revealArea(boards[seat], layout.startRow(), layout.startCol()); // 모두 같은 빈 영역을 미리 연다
        }
        this.clicks = new int[seatCount];
        this.explodedAt = new int[seatCount][];
        this.standings = new RaceStandings(seatCount);
    }

    /** 무작위 칸 하나를 고르고, 그 칸과 이웃을 피해 지뢰를 놓는다(그 칸은 주변 지뢰 0 → 넓게 열린다) */
    static Layout createLayout(Difficulty difficulty, Random random) {
        int startRow = random.nextInt(difficulty.rows);
        int startCol = random.nextInt(difficulty.cols);
        List<int[]> candidates = new ArrayList<>();
        for (int row = 0; row < difficulty.rows; row++) {
            for (int col = 0; col < difficulty.cols; col++) {
                if (Math.abs(row - startRow) > 1 || Math.abs(col - startCol) > 1) candidates.add(new int[] {row, col});
            }
        }
        Collections.shuffle(candidates, random);
        boolean[][] mines = new boolean[difficulty.rows][difficulty.cols];
        for (int[] cell : candidates.subList(0, difficulty.mines)) mines[cell[0]][cell[1]] = true;
        return new Layout(mines, startRow, startCol);
    }

    @Override
    public void act(int seat, GameAction action) {
        if (!standings.isPlaying(seat)) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        String name = action.actionName();
        if (!name.equals("REVEAL") && !name.equals("FLAG") && !name.equals("CHORD")) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        int[] cell = requireCell(action.numbers());
        CellState[][] board = boards[seat];
        switch (name) {
            case "FLAG" -> toggleFlag(board, cell[0], cell[1]);
            case "REVEAL" -> {
                if (board[cell[0]][cell[1]] == CellState.HIDDEN) open(seat, List.of(cell));
            }
            default -> chord(seat, cell[0], cell[1]);
        }
    }

    private static void toggleFlag(CellState[][] board, int row, int col) {
        if (board[row][col] == CellState.HIDDEN) board[row][col] = CellState.FLAGGED;
        else if (board[row][col] == CellState.FLAGGED) board[row][col] = CellState.HIDDEN;
    }

    /** 열린 숫자 칸: 주변 깃발 수가 숫자와 같으면 닫힌 이웃을 연다. 조건이 안 맞거나 열 칸이 없으면 아무 일도 없다 */
    private void chord(int seat, int row, int col) {
        CellState[][] board = boards[seat];
        if (board[row][col] != CellState.REVEALED || adjacent[row][col] == 0) return;
        List<int[]> neighbors = neighbors(row, col);
        long flags = neighbors.stream().filter(cell -> board[cell[0]][cell[1]] == CellState.FLAGGED).count();
        List<int[]> hidden = neighbors.stream().filter(cell -> board[cell[0]][cell[1]] == CellState.HIDDEN).toList();
        if (flags != adjacent[row][col] || hidden.isEmpty()) return;
        open(seat, hidden);
    }

    /** 칸들을 연다(클릭 1번). 지뢰가 있으면 실패, 안전한 칸을 모두 열면 성공 */
    private void open(int seat, List<int[]> targets) {
        clicks[seat]++;
        for (int[] cell : targets) {
            if (mines[cell[0]][cell[1]]) {
                explodedAt[seat] = cell;
                standings.fail(seat);
                announcements.add(nicknames.get(seat) + "님이 지뢰를 밟았습니다. (" + countRevealed(seat) + "칸 열기)");
                return;
            }
            revealArea(boards[seat], cell[0], cell[1]);
        }
        if (countRevealed(seat) == rows * cols - difficulty.mines) {
            standings.succeed(seat);
            announcements.add(nicknames.get(seat) + "님이 지뢰를 모두 피했습니다! (" + clicks[seat] + "번 클릭)");
        }
    }

    /** start 칸을 열고, 주변 지뢰가 0인 칸이면 이웃으로 넓힌다(BFS). 깃발 칸·지뢰 칸은 넓히는 중에 열지 않는다 */
    private void revealArea(CellState[][] board, int startRow, int startCol) {
        if (board[startRow][startCol] != CellState.HIDDEN) return;
        Deque<int[]> queue = new ArrayDeque<>();
        board[startRow][startCol] = CellState.REVEALED;
        queue.add(new int[] {startRow, startCol});
        while (!queue.isEmpty()) {
            int[] current = queue.poll();
            if (adjacent[current[0]][current[1]] > 0) continue; // 숫자 칸에서는 더 넓히지 않는다
            for (int[] neighbor : neighbors(current[0], current[1])) {
                if (board[neighbor[0]][neighbor[1]] != CellState.HIDDEN || mines[neighbor[0]][neighbor[1]]) continue;
                board[neighbor[0]][neighbor[1]] = CellState.REVEALED;
                queue.add(neighbor);
            }
        }
    }

    @Override
    public void leave(int seat) {
        if (seat < 0 || seat >= boards.length) return;
        if (standings.leave(seat)) announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
    }

    @Override
    public boolean isFinished() {
        return standings.isFinished();
    }

    @Override
    public boolean hasSettledResult(int seat) {
        if (seat < 0 || seat >= boards.length) return false;
        RaceStandings.Status status = standings.statusOf(seat);
        return status == RaceStandings.Status.SUCCESS || status == RaceStandings.Status.FAILED;
    }

    @Override
    public List<Integer> winnerSeats() {
        return standings.winners(seat -> clicks[seat], this::countRevealed);
    }

    /** 예: "지뢰 찾기 대전(초급) 1위 철수 35번 클릭으로 성공 · 2위 영희 40칸 · 3위 민수 빠짐" */
    @Override
    public String resultText() {
        int[] ranks = standings.ranks(seat -> clicks[seat], this::countRevealed);
        List<Integer> order = new ArrayList<>();
        for (int seat = 0; seat < boards.length; seat++) order.add(seat);
        order.sort((left, right) -> Integer.compare(ranks[left], ranks[right]));
        List<String> parts = new ArrayList<>();
        for (int seat : order) parts.add(ranks[seat] + "위 " + nicknames.get(seat) + " " + describeResult(seat));
        return "지뢰 찾기 대전(" + difficulty.label + ") " + String.join(" · ", parts);
    }

    private String describeResult(int seat) {
        return switch (standings.statusOf(seat)) {
            case SUCCESS -> clicks[seat] + "번 클릭으로 성공";
            case LEFT -> "빠짐";
            case FAILED, PLAYING -> countRevealed(seat) + "칸";
        };
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean isPlayer = seat != null && seat >= 0 && seat < boards.length;
        boolean finished = standings.isFinished();
        int[] ranks = finished ? standings.ranks(index -> clicks[index], this::countRevealed) : null;
        List<PlayerView> players = new ArrayList<>();
        for (int index = 0; index < boards.length; index++) {
            players.add(new PlayerView(
                nicknames.get(index), rowsOf(index, finished), clicks[index], countRevealed(index), countFlags(index),
                standings.statusOf(index).name(), standings.finishOrderOf(index), ranks == null ? null : ranks[index]));
        }
        return new View(isPlayer ? seat : null, difficulty.name(), rows, cols, difficulty.mines, rows * cols - difficulty.mines,
            players, winnerSeats(), finished);
    }

    /** 판 → 한 줄에 한 글자씩. 지뢰("*"·"X"·"W")는 revealMines(게임이 끝났을 때)일 때만 쓴다 */
    private List<String> rowsOf(int seat, boolean revealMines) {
        CellState[][] board = boards[seat];
        int[] exploded = explodedAt[seat];
        List<String> lines = new ArrayList<>();
        for (int row = 0; row < rows; row++) {
            StringBuilder line = new StringBuilder();
            for (int col = 0; col < cols; col++) {
                CellState state = board[row][col];
                boolean mine = mines[row][col];
                if (revealMines && exploded != null && exploded[0] == row && exploded[1] == col) line.append('X');
                else if (state == CellState.FLAGGED) line.append(revealMines && !mine ? 'W' : 'F');
                else if (state == CellState.REVEALED) line.append((char) ('0' + adjacent[row][col]));
                else line.append(revealMines && mine ? '*' : '.');
            }
            lines.add(line.toString());
        }
        return lines;
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }

    private int countRevealed(int seat) {
        return countState(seat, CellState.REVEALED);
    }

    private int countFlags(int seat) {
        return countState(seat, CellState.FLAGGED);
    }

    private int countState(int seat, CellState target) {
        int count = 0;
        for (CellState[] row : boards[seat]) for (CellState state : row) if (state == target) count++;
        return count;
    }

    private List<int[]> neighbors(int row, int col) {
        List<int[]> neighbors = new ArrayList<>();
        for (int rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (int colOffset = -1; colOffset <= 1; colOffset++) {
                int nextRow = row + rowOffset;
                int nextCol = col + colOffset;
                if ((rowOffset != 0 || colOffset != 0) && nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
                    neighbors.add(new int[] {nextRow, nextCol});
                }
            }
        }
        return neighbors;
    }

    private static int[][] countAdjacent(boolean[][] mines) {
        int rowCount = mines.length;
        int colCount = mines[0].length;
        int[][] counts = new int[rowCount][colCount];
        for (int row = 0; row < rowCount; row++) {
            for (int col = 0; col < colCount; col++) {
                for (int r = Math.max(0, row - 1); r <= Math.min(rowCount - 1, row + 1); r++) {
                    for (int c = Math.max(0, col - 1); c <= Math.min(colCount - 1, col + 1); c++) {
                        if ((r != row || c != col) && mines[r][c]) counts[row][col]++;
                    }
                }
            }
        }
        return counts;
    }

    private int[] requireCell(List<Integer> position) {
        if (position == null || position.size() != 2 || position.get(0) == null || position.get(1) == null) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 밖의 칸입니다.");
        }
        int row = position.get(0);
        int col = position.get(1);
        if (row < 0 || row >= rows || col < 0 || col >= cols) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 밖의 칸입니다.");
        return new int[] {row, col};
    }
}
