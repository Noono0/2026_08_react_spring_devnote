package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.List;

/**
 * 장기(2명). 0번 자리 = 초(아래, 먼저 둠), 1번 자리 = 한(위).
 *
 * [상차림] 시작 전에 각자 바깥쪽 두 칸씩의 마·상 위치를 고른다(ARRANGE).
 *   왼쪽부터 "마상마상"·"상마상마"·"마상상마"·"상마마상" 네 가지. 둘 다 고르면 대국이 시작된다.
 * [판] 가로 9줄 × 세로 10줄의 교차점. 궁성은 양쪽 3×3이고 궁성 안에는 대각선 길이 있다.
 * [기물]
 *   궁·사: 궁성 안에서 선을 따라 한 칸(궁성 대각선 포함)
 *   차: 가로·세로로 막힐 때까지(궁성 대각선도)
 *   포: 기물 하나(포가 아닌 것)를 뛰어넘어 가로·세로로(궁성 대각선도). 포는 포를 잡을 수 없다
 *   마: 한 칸 곧게 + 한 칸 대각선(곧게 가는 첫 칸이 막히면 못 감)
 *   상: 한 칸 곧게 + 두 칸 대각선(가는 길의 칸이 막히면 못 감)
 *   졸·병: 앞이나 옆으로 한 칸. 상대 궁성 안에서는 대각선 앞으로도 한 칸
 * [장군] 내 궁이 잡힐 수 있는 수는 둘 수 없다(서버가 합법수만 보낸다). 장군을 막을 수 없으면 외통(패배).
 *   장군이 아닐 때는 한 수 쉴 수 있다(PASS). 둘이 연달아 쉬거나 200수가 되면 남은 기물 점수로 끝낸다.
 * [점수] 차 13 · 포 7 · 마 5 · 상 3 · 사 3 · 졸 2, 한(후수)에 덤 1.5점. 화면에는 반 점 단위로 보낸다(점수 × 2).
 *
 * ★ 학습용 단순화: 빅장(두 궁이 마주 보면 무승부)·같은 수 반복 금지 규칙은 넣지 않았다.
 */
public class JanggiGame implements OnlineGame {
    public static final int ROWS = 10;
    public static final int COLS = 9;
    public static final int MAX_MOVES = 200;
    /** 상차림: 바깥쪽 왼쪽 두 칸(1·2열)과 오른쪽 두 칸(6·7열)에 놓을 순서. H = 마, E = 상 */
    public static final List<String> FORMATIONS = List.of("HEHE", "EHEH", "HEEH", "EHHE");
    private static final int[][] ORTHOGONAL = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};

    public enum Phase { SETUP, PLAY, END }

    public record Move(int fromRow, int fromCol, int toRow, int toCol) {}

    /**
     * board: 10줄 × 9글자. 대문자 = 초, 소문자 = 한, '.' = 빈칸
     *   K 궁 · R 차 · C 포 · H 마 · E 상 · A 사 · P 졸(병)
     * scores: [초, 한] 반 점 단위(점수 × 2). moves: 내 차례일 때만 둘 수 있는 수
     */
    public record View(Integer mySeat, Phase phase, List<String> board, List<Boolean> arranged, String myFormation, int turnSeat,
                       boolean inCheck, List<Move> moves, boolean canPass, Move lastMove, List<Integer> scores, int moveCount,
                       List<String> log, Integer winnerSeat, String result, boolean finished) {}

    private final List<String> nicknames;
    private final char[][] board = new char[ROWS][COLS];
    private final String[] formations = new String[2];
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.SETUP;
    private int turnSeat;
    private int moveCount;
    private int consecutivePasses;
    private Move lastMove;
    private Integer winnerSeat;
    private String result;

    public JanggiGame(List<String> nicknames) {
        if (nicknames.size() != 2) throw new IllegalArgumentException("장기는 2명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        for (char[] row : board) java.util.Arrays.fill(row, '.');
        say("장기 시작! 초(" + nicknames.get(0) + ")와 한(" + nicknames.get(1) + ")은 마·상 위치(상차림)를 고르세요.");
    }

    private void say(String text) {
        announcements.add(text);
        note(text);
    }

    private void note(String text) {
        log.add(text);
        if (log.size() > 30) log.remove(0);
    }

    // ── 판 도우미 ────────────────────────────────────────────────────

    private static boolean inside(int row, int col) {
        return row >= 0 && row < ROWS && col >= 0 && col < COLS;
    }

    /** 0 = 초(대문자), 1 = 한(소문자), -1 = 빈칸 */
    private static int sideOf(char piece) {
        if (piece == '.') return -1;
        return Character.isUpperCase(piece) ? 0 : 1;
    }

    private static char typeOf(char piece) {
        return Character.toUpperCase(piece);
    }

    /** 궁성 안인지. side가 null이면 양쪽 궁성 모두 */
    private static boolean inPalace(int row, int col, Integer side) {
        if (col < 3 || col > 5) return false;
        boolean top = row >= 0 && row <= 2;
        boolean bottom = row >= 7 && row <= 9;
        if (side == null) return top || bottom;
        return side == 0 ? bottom : top;
    }

    /** 궁성 대각선 위의 점(네 귀퉁이와 가운데)인지 */
    private static boolean onPalaceDiagonal(int row, int col) {
        if (!inPalace(row, col, null)) return false;
        int localRow = row <= 2 ? row : row - 7;
        return (localRow + (col - 3)) % 2 == 0; // (0,0)(0,2)(1,1)(2,0)(2,2)
    }

    /** 궁성 대각선을 따라 한 칸 간 점(같은 궁성 안, 대각선 위). 없으면 null */
    private static int[] palaceDiagonalStep(int row, int col, int dRow, int dCol) {
        if (!onPalaceDiagonal(row, col)) return null;
        int nextRow = row + dRow;
        int nextCol = col + dCol;
        boolean samePalace = (row <= 2) == (nextRow <= 2);
        if (!inside(nextRow, nextCol) || !samePalace || !onPalaceDiagonal(nextRow, nextCol)) return null;
        return new int[]{nextRow, nextCol};
    }

    // ── 상차림 ──────────────────────────────────────────────────────

    private void arrange(int seat, String formation) {
        if (phase != Phase.SETUP) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이미 대국이 시작됐습니다.");
        if (formation == null || !FORMATIONS.contains(formation)) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "상차림을 골라 주세요.");
        formations[seat] = formation;
        if (formations[0] == null || formations[1] == null) return;
        setUpBoard();
        phase = Phase.PLAY;
        say("대국 시작! 초가 먼저 둡니다.");
    }

    private void setUpBoard() {
        for (int seat = 0; seat < 2; seat++) {
            int back = seat == 0 ? 9 : 0;
            int palaceCenter = seat == 0 ? 8 : 1;
            int cannons = seat == 0 ? 7 : 2;
            int soldiers = seat == 0 ? 6 : 3;
            String formation = formations[seat];
            // 한은 판 위쪽에서 아래를 보고 앉으므로, 한 사람이 고른 "왼쪽"은 판 오른쪽이다
            int[] cols = seat == 0 ? new int[]{1, 2, 6, 7} : new int[]{7, 6, 2, 1};
            char[] backRow = {'R', '.', '.', 'A', '.', 'A', '.', '.', 'R'};
            for (int index = 0; index < 4; index++) backRow[cols[index]] = formation.charAt(index);
            for (int col = 0; col < COLS; col++) board[back][col] = mark(seat, backRow[col]);
            board[palaceCenter][4] = mark(seat, 'K');
            board[cannons][1] = mark(seat, 'C');
            board[cannons][7] = mark(seat, 'C');
            for (int col = 0; col < COLS; col += 2) board[soldiers][col] = mark(seat, 'P');
        }
    }

    private static char mark(int side, char type) {
        if (type == '.') return '.';
        return side == 0 ? Character.toUpperCase(type) : Character.toLowerCase(type);
    }

    // ── 수 만들기 ────────────────────────────────────────────────────

    /** 궁이 잡히는지는 따지지 않은 "기물이 갈 수 있는 곳" */
    private List<Move> pseudoMoves(int side) {
        List<Move> moves = new ArrayList<>();
        for (int row = 0; row < ROWS; row++) {
            for (int col = 0; col < COLS; col++) {
                char piece = board[row][col];
                if (sideOf(piece) != side) continue;
                switch (typeOf(piece)) {
                    case 'K', 'A' -> palaceStepMoves(row, col, side, moves);
                    case 'R' -> chariotMoves(row, col, side, moves);
                    case 'C' -> cannonMoves(row, col, side, moves);
                    case 'H' -> horseMoves(row, col, side, moves);
                    case 'E' -> elephantMoves(row, col, side, moves);
                    case 'P' -> soldierMoves(row, col, side, moves);
                    default -> { }
                }
            }
        }
        return moves;
    }

    private void addIfFreeOrEnemy(int fromRow, int fromCol, int toRow, int toCol, int side, List<Move> moves) {
        if (!inside(toRow, toCol) || sideOf(board[toRow][toCol]) == side) return;
        moves.add(new Move(fromRow, fromCol, toRow, toCol));
    }

    private void palaceStepMoves(int row, int col, int side, List<Move> moves) {
        for (int[] direction : ORTHOGONAL) {
            int toRow = row + direction[0];
            int toCol = col + direction[1];
            if (inPalace(toRow, toCol, side)) addIfFreeOrEnemy(row, col, toRow, toCol, side, moves);
        }
        for (int dRow = -1; dRow <= 1; dRow += 2) {
            for (int dCol = -1; dCol <= 1; dCol += 2) {
                int[] step = palaceDiagonalStep(row, col, dRow, dCol);
                if (step != null && inPalace(step[0], step[1], side)) addIfFreeOrEnemy(row, col, step[0], step[1], side, moves);
            }
        }
    }

    /** 한 방향으로 쭉 간 칸들. diagonal이면 궁성 대각선을 따라간다 */
    private List<int[]> ray(int row, int col, int dRow, int dCol, boolean diagonal) {
        List<int[]> cells = new ArrayList<>();
        int currentRow = row;
        int currentCol = col;
        while (true) {
            int[] next = diagonal ? palaceDiagonalStep(currentRow, currentCol, dRow, dCol) : new int[]{currentRow + dRow, currentCol + dCol};
            if (next == null || !inside(next[0], next[1])) return cells;
            cells.add(next);
            currentRow = next[0];
            currentCol = next[1];
        }
    }

    private List<List<int[]>> allRays(int row, int col) {
        List<List<int[]>> rays = new ArrayList<>();
        for (int[] direction : ORTHOGONAL) rays.add(ray(row, col, direction[0], direction[1], false));
        for (int dRow = -1; dRow <= 1; dRow += 2) for (int dCol = -1; dCol <= 1; dCol += 2) rays.add(ray(row, col, dRow, dCol, true));
        return rays;
    }

    private void chariotMoves(int row, int col, int side, List<Move> moves) {
        for (List<int[]> cells : allRays(row, col)) {
            for (int[] cell : cells) {
                char target = board[cell[0]][cell[1]];
                if (sideOf(target) != side) moves.add(new Move(row, col, cell[0], cell[1]));
                if (target != '.') break;
            }
        }
    }

    private void cannonMoves(int row, int col, int side, List<Move> moves) {
        for (List<int[]> cells : allRays(row, col)) {
            boolean jumped = false;
            for (int[] cell : cells) {
                char target = board[cell[0]][cell[1]];
                if (!jumped) {
                    if (target == '.') continue;
                    if (typeOf(target) == 'C') break; // 포는 포를 넘을 수 없다
                    jumped = true;
                    continue;
                }
                if (target == '.') {
                    moves.add(new Move(row, col, cell[0], cell[1]));
                    continue;
                }
                if (sideOf(target) != side && typeOf(target) != 'C') moves.add(new Move(row, col, cell[0], cell[1])); // 포는 포를 잡을 수 없다
                break;
            }
        }
    }

    private void horseMoves(int row, int col, int side, List<Move> moves) {
        for (int[] direction : ORTHOGONAL) {
            int legRow = row + direction[0];
            int legCol = col + direction[1];
            if (!inside(legRow, legCol) || board[legRow][legCol] != '.') continue; // 첫 칸이 막히면 못 간다
            for (int spread = -1; spread <= 1; spread += 2) {
                int toRow = legRow + direction[0] + (direction[0] == 0 ? spread : 0);
                int toCol = legCol + direction[1] + (direction[1] == 0 ? spread : 0);
                addIfFreeOrEnemy(row, col, toRow, toCol, side, moves);
            }
        }
    }

    private void elephantMoves(int row, int col, int side, List<Move> moves) {
        for (int[] direction : ORTHOGONAL) {
            int legRow = row + direction[0];
            int legCol = col + direction[1];
            if (!inside(legRow, legCol) || board[legRow][legCol] != '.') continue;
            for (int spread = -1; spread <= 1; spread += 2) {
                int stepRow = direction[0] == 0 ? spread : direction[0];
                int stepCol = direction[1] == 0 ? spread : direction[1];
                int middleRow = legRow + stepRow;
                int middleCol = legCol + stepCol;
                if (!inside(middleRow, middleCol) || board[middleRow][middleCol] != '.') continue; // 가는 길 두 번째 칸도 비어야 한다
                addIfFreeOrEnemy(row, col, middleRow + stepRow, middleCol + stepCol, side, moves);
            }
        }
    }

    private void soldierMoves(int row, int col, int side, List<Move> moves) {
        int forward = side == 0 ? -1 : 1;
        addIfFreeOrEnemy(row, col, row + forward, col, side, moves);
        addIfFreeOrEnemy(row, col, row, col - 1, side, moves);
        addIfFreeOrEnemy(row, col, row, col + 1, side, moves);
        int enemy = 1 - side;
        for (int dCol = -1; dCol <= 1; dCol += 2) {
            int[] step = palaceDiagonalStep(row, col, forward, dCol);
            if (step != null && inPalace(step[0], step[1], enemy)) addIfFreeOrEnemy(row, col, step[0], step[1], side, moves);
        }
    }

    private int[] findKing(int side) {
        char king = mark(side, 'K');
        for (int row = 0; row < ROWS; row++) for (int col = 0; col < COLS; col++) if (board[row][col] == king) return new int[]{row, col};
        return null;
    }

    /** side의 궁이 지금 상대에게 잡힐 수 있는지(장군) */
    boolean isInCheck(int side) {
        int[] king = findKing(side);
        if (king == null) return true;
        for (Move move : pseudoMoves(1 - side)) if (move.toRow() == king[0] && move.toCol() == king[1]) return true;
        return false;
    }

    /** 둔 뒤에 내 궁이 잡히지 않는 수만 남긴다 */
    List<Move> legalMoves(int side) {
        List<Move> legal = new ArrayList<>();
        for (Move move : pseudoMoves(side)) {
            char moving = board[move.fromRow()][move.fromCol()];
            char captured = board[move.toRow()][move.toCol()];
            board[move.toRow()][move.toCol()] = moving;
            board[move.fromRow()][move.fromCol()] = '.';
            if (!isInCheck(side)) legal.add(move);
            board[move.fromRow()][move.fromCol()] = moving;
            board[move.toRow()][move.toCol()] = captured;
        }
        return legal;
    }

    // ── 진행 ─────────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.END || seat < 0 || seat > 1) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (action.actionName().equals("ARRANGE")) {
            arrange(seat, action.text());
            return;
        }
        if (phase != Phase.PLAY) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "두 사람이 상차림을 고르면 시작합니다.");
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        switch (action.actionName()) {
            case "MOVE" -> move(seat, action.numbers());
            case "PASS" -> pass(seat);
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void move(int seat, List<Integer> numbers) {
        if (numbers == null || numbers.size() != 4 || numbers.stream().anyMatch(java.util.Objects::isNull)) {
            throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
        Move requested = new Move(numbers.get(0), numbers.get(1), numbers.get(2), numbers.get(3));
        if (!legalMoves(seat).contains(requested)) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "둘 수 없는 수입니다.");
        char moving = board[requested.fromRow()][requested.fromCol()];
        char captured = board[requested.toRow()][requested.toCol()];
        board[requested.toRow()][requested.toCol()] = moving;
        board[requested.fromRow()][requested.fromCol()] = '.';
        lastMove = requested;
        moveCount++;
        consecutivePasses = 0;
        String sideName = seat == 0 ? "초" : "한";
        note(moveCount + ". " + sideName + " " + pieceLabel(moving) + (captured == '.' ? "" : " → " + pieceLabel(captured) + " 잡음"));
        turnSeat = 1 - seat;
        afterTurn();
    }

    private void pass(int seat) {
        if (isInCheck(seat)) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "장군일 때는 쉴 수 없습니다. 궁을 지키세요.");
        consecutivePasses++;
        moveCount++;
        lastMove = null;
        note(moveCount + ". " + (seat == 0 ? "초" : "한") + " 한 수 쉼");
        turnSeat = 1 - seat;
        if (consecutivePasses >= 2) {
            finishByScore("두 사람이 연달아 쉬어");
            return;
        }
        afterTurn();
    }

    /** 차례가 넘어간 뒤: 외통·장군·수 제한을 확인한다 */
    private void afterTurn() {
        boolean check = isInCheck(turnSeat);
        if (check && legalMoves(turnSeat).isEmpty()) {
            winnerSeat = 1 - turnSeat;
            result = "외통! " + (winnerSeat == 0 ? "초" : "한") + " " + nicknames.get(winnerSeat) + " 승리";
            phase = Phase.END;
            say(result);
            return;
        }
        if (check) say("장군! " + (turnSeat == 0 ? "초" : "한") + "은 궁을 지키세요.");
        if (moveCount >= MAX_MOVES) finishByScore(MAX_MOVES + "수가 되어");
    }

    private static int pieceHalfPoints(char piece) {
        return switch (typeOf(piece)) {
            case 'R' -> 26;
            case 'C' -> 14;
            case 'H' -> 10;
            case 'E', 'A' -> 6;
            case 'P' -> 4;
            default -> 0;
        };
    }

    /** [초, 한] 남은 기물 점수(반 점 단위). 한은 후수라 덤 1.5점(= 3) */
    List<Integer> halfPointScores() {
        int[] scores = {0, 3};
        for (char[] row : board) for (char piece : row) if (piece != '.') scores[sideOf(piece)] += pieceHalfPoints(piece);
        return List.of(scores[0], scores[1]);
    }

    private void finishByScore(String reason) {
        List<Integer> scores = halfPointScores();
        winnerSeat = scores.get(0) > scores.get(1) ? 0 : 1; // 덤 반 점 때문에 같은 점수는 나오지 않는다
        result = reason + " 점수로 끝: 초 " + scores.get(0) / 2.0 + " · 한 " + scores.get(1) / 2.0 + " → " + nicknames.get(winnerSeat) + " 승리";
        phase = Phase.END;
        say(result);
    }

    private static String pieceLabel(char piece) {
        return switch (typeOf(piece)) {
            case 'K' -> "궁";
            case 'R' -> "차";
            case 'C' -> "포";
            case 'H' -> "마";
            case 'E' -> "상";
            case 'A' -> "사";
            case 'P' -> sideOf(piece) == 0 ? "졸" : "병";
            default -> "?";
        };
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.END || seat < 0 || seat > 1) return;
        winnerSeat = 1 - seat;
        result = nicknames.get(seat) + " 님이 나가 " + nicknames.get(winnerSeat) + " 승리";
        phase = Phase.END;
        say(result);
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.END;
    }

    @Override
    public String resultText() {
        return "장기 " + (result == null ? "끝" : result);
    }

    @Override
    public List<Integer> winnerSeats() {
        return winnerSeat == null ? List.of() : List.of(winnerSeat);
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean player = seat != null && (seat == 0 || seat == 1);
        List<String> rows = new ArrayList<>();
        for (char[] row : board) rows.add(new String(row));
        boolean myTurn = player && phase == Phase.PLAY && seat == turnSeat;
        boolean check = phase == Phase.PLAY && isInCheck(turnSeat);
        return new View(player ? seat : null, phase, rows, List.of(formations[0] != null, formations[1] != null),
            player ? formations[seat] : null, turnSeat, check, myTurn ? legalMoves(seat) : List.of(), myTurn && !check, lastMove,
            phase == Phase.SETUP ? List.of(0, 3) : halfPointScores(), moveCount, List.copyOf(log), winnerSeat, result, phase == Phase.END);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }

    /** 테스트용: 판을 직접 놓고 대국 상태로 시작한다(10줄 × 9글자) */
    void setBoard(List<String> rows, int nextTurnSeat) {
        for (int row = 0; row < ROWS; row++) board[row] = rows.get(row).toCharArray();
        formations[0] = FORMATIONS.get(0);
        formations[1] = FORMATIONS.get(0);
        phase = Phase.PLAY;
        turnSeat = nextTurnSeat;
    }
}
