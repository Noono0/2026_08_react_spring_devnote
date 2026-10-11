package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 체스(2명). 0번 자리 = 백(먼저), 1번 자리 = 흑.
 *
 * [판 표현] board[행][열], 0행 = 8랭크(흑 쪽), 7행 = 1랭크(백 쪽), 0열 = a파일.
 *   대문자 = 백(K Q R B N P), 소문자 = 흑, '.' = 빈칸
 *
 * [규칙] 기물 이동, 캐슬링(킹·퀸 쪽), 앙파상, 프로모션(Q·R·B·N), 체크·체크메이트·스테일메이트,
 *        무승부: 50수 규칙, 같은 국면 3번 반복, 기물 부족(킹 대 킹, 킹+비숍/나이트 대 킹)
 * [수 만들기] 기물 규칙대로 갈 수 있는 수를 모두 만든 뒤, 둔 다음 내 킹이 공격받는 수는 뺀다(합법수).
 */
public class ChessGame implements OnlineGame {
    public record Move(int fromRow, int fromCol, int toRow, int toCol, char promotion) {}

    public record View(Integer mySeat, String myColor, List<String> board, Integer turnSeat, boolean inCheck,
                       List<Integer> lastMove, List<List<Integer>> legalMoves, List<String> history,
                       List<String> capturedByWhite, List<String> capturedByBlack, Integer winnerSeat, String result, boolean finished) {}

    private static final int[][] KNIGHT = {{-2, -1}, {-2, 1}, {-1, -2}, {-1, 2}, {1, -2}, {1, 2}, {2, -1}, {2, 1}};
    private static final int[][] KING = {{-1, -1}, {-1, 0}, {-1, 1}, {0, -1}, {0, 1}, {1, -1}, {1, 0}, {1, 1}};
    private static final int[][] DIAGONAL = {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}};
    private static final int[][] STRAIGHT = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};

    private final List<String> nicknames;
    private char[][] board = new char[8][8];
    private boolean whiteToMove = true;
    private boolean whiteKingSide = true, whiteQueenSide = true, blackKingSide = true, blackQueenSide = true;
    /** 앙파상으로 잡을 수 있는 칸(바로 전 수에 폰이 두 칸 전진했을 때). 없으면 null */
    private int[] enPassant;
    private int halfmoveClock;
    private final Map<String, Integer> positions = new HashMap<>();
    private final List<String> history = new ArrayList<>();
    private final List<String> capturedByWhite = new ArrayList<>();
    private final List<String> capturedByBlack = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Move lastMove;
    private boolean finished;
    private Integer winnerSeat;
    private String result;

    public ChessGame(List<String> nicknames) {
        if (nicknames.size() != 2) throw new IllegalArgumentException("체스는 2명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        setPosition(new String[] {"rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"}, true);
    }

    /** 테스트용: 국면을 직접 정한다(캐슬링은 킹·룩이 처음 자리에 있으면 가능으로 본다) */
    void setPosition(String[] rows, boolean whiteToMove) {
        for (int row = 0; row < 8; row++) board[row] = rows[row].toCharArray();
        this.whiteToMove = whiteToMove;
        whiteKingSide = board[7][4] == 'K' && board[7][7] == 'R';
        whiteQueenSide = board[7][4] == 'K' && board[7][0] == 'R';
        blackKingSide = board[0][4] == 'k' && board[0][7] == 'r';
        blackQueenSide = board[0][4] == 'k' && board[0][0] == 'r';
        enPassant = null;
        positions.clear();
        positions.merge(positionKey(), 1, Integer::sum);
    }

    // ── 기본 도우미 ──────────────────────────────────────────────

    private static boolean inside(int row, int col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    private static boolean isWhite(char piece) {
        return Character.isUpperCase(piece);
    }

    private static boolean isEnemy(char piece, boolean white) {
        return piece != '.' && isWhite(piece) != white;
    }

    private static char[][] copy(char[][] source) {
        char[][] copied = new char[8][];
        for (int row = 0; row < 8; row++) copied[row] = source[row].clone();
        return copied;
    }

    /** (row, col)이 white 쪽 기물에게 공격받고 있는가 */
    static boolean attacked(char[][] board, int row, int col, boolean byWhite) {
        int pawnRow = row + (byWhite ? 1 : -1); // 백 폰은 아래(큰 행)에서 위를 공격한다
        for (int dc : new int[] {-1, 1}) {
            if (inside(pawnRow, col + dc) && board[pawnRow][col + dc] == (byWhite ? 'P' : 'p')) return true;
        }
        for (int[] offset : KNIGHT) {
            int r = row + offset[0], c = col + offset[1];
            if (inside(r, c) && board[r][c] == (byWhite ? 'N' : 'n')) return true;
        }
        for (int[] offset : KING) {
            int r = row + offset[0], c = col + offset[1];
            if (inside(r, c) && board[r][c] == (byWhite ? 'K' : 'k')) return true;
        }
        if (slidingAttack(board, row, col, DIAGONAL, byWhite ? "BQ" : "bq")) return true;
        return slidingAttack(board, row, col, STRAIGHT, byWhite ? "RQ" : "rq");
    }

    private static boolean slidingAttack(char[][] board, int row, int col, int[][] directions, String attackers) {
        for (int[] direction : directions) {
            int r = row + direction[0], c = col + direction[1];
            while (inside(r, c)) {
                if (board[r][c] != '.') {
                    if (attackers.indexOf(board[r][c]) >= 0) return true;
                    break;
                }
                r += direction[0];
                c += direction[1];
            }
        }
        return false;
    }

    private int[] kingSquare(char[][] board, boolean white) {
        char king = white ? 'K' : 'k';
        for (int row = 0; row < 8; row++) for (int col = 0; col < 8; col++) if (board[row][col] == king) return new int[] {row, col};
        return new int[] {-1, -1};
    }

    boolean inCheck(boolean white) {
        int[] king = kingSquare(board, white);
        return king[0] >= 0 && attacked(board, king[0], king[1], !white);
    }

    // ── 수 만들기 ────────────────────────────────────────────────

    /** 지금 차례의 합법수 */
    List<Move> legalMoves() {
        List<Move> legal = new ArrayList<>();
        for (Move move : pseudoMoves(whiteToMove)) {
            char[][] after = copy(board);
            applyTo(after, move);
            int[] king = kingSquare(after, whiteToMove);
            if (!attacked(after, king[0], king[1], !whiteToMove)) legal.add(move);
        }
        return legal;
    }

    private List<Move> pseudoMoves(boolean white) {
        List<Move> moves = new ArrayList<>();
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                char piece = board[row][col];
                if (piece == '.' || isWhite(piece) != white) continue;
                switch (Character.toUpperCase(piece)) {
                    case 'P' -> pawnMoves(row, col, white, moves);
                    case 'N' -> stepMoves(row, col, white, KNIGHT, moves);
                    case 'B' -> slideMoves(row, col, white, DIAGONAL, moves);
                    case 'R' -> slideMoves(row, col, white, STRAIGHT, moves);
                    case 'Q' -> { slideMoves(row, col, white, DIAGONAL, moves); slideMoves(row, col, white, STRAIGHT, moves); }
                    case 'K' -> { stepMoves(row, col, white, KING, moves); castleMoves(row, col, white, moves); }
                    default -> { }
                }
            }
        }
        return moves;
    }

    private void pawnMoves(int row, int col, boolean white, List<Move> moves) {
        int direction = white ? -1 : 1;
        int startRow = white ? 6 : 1;
        int lastRow = white ? 0 : 7;
        int next = row + direction;
        if (inside(next, col) && board[next][col] == '.') {
            addPawnMove(row, col, next, col, lastRow, moves);
            if (row == startRow && board[row + 2 * direction][col] == '.') moves.add(new Move(row, col, row + 2 * direction, col, ' '));
        }
        for (int dc : new int[] {-1, 1}) {
            int c = col + dc;
            if (!inside(next, c)) continue;
            boolean capture = isEnemy(board[next][c], white);
            boolean passant = enPassant != null && enPassant[0] == next && enPassant[1] == c;
            if (capture || passant) addPawnMove(row, col, next, c, lastRow, moves);
        }
    }

    private static void addPawnMove(int row, int col, int toRow, int toCol, int lastRow, List<Move> moves) {
        if (toRow == lastRow) for (char promotion : new char[] {'Q', 'R', 'B', 'N'}) moves.add(new Move(row, col, toRow, toCol, promotion));
        else moves.add(new Move(row, col, toRow, toCol, ' '));
    }

    private void stepMoves(int row, int col, boolean white, int[][] offsets, List<Move> moves) {
        for (int[] offset : offsets) {
            int r = row + offset[0], c = col + offset[1];
            if (inside(r, c) && (board[r][c] == '.' || isEnemy(board[r][c], white))) moves.add(new Move(row, col, r, c, ' '));
        }
    }

    private void slideMoves(int row, int col, boolean white, int[][] directions, List<Move> moves) {
        for (int[] direction : directions) {
            int r = row + direction[0], c = col + direction[1];
            while (inside(r, c)) {
                if (board[r][c] == '.') moves.add(new Move(row, col, r, c, ' '));
                else {
                    if (isEnemy(board[r][c], white)) moves.add(new Move(row, col, r, c, ' '));
                    break;
                }
                r += direction[0];
                c += direction[1];
            }
        }
    }

    /** 캐슬링: 권리가 있고, 사이 칸이 비었고, 킹이 지금·지나가는·도착 칸에서 공격받지 않을 때 */
    private void castleMoves(int row, int col, boolean white, List<Move> moves) {
        int home = white ? 7 : 0;
        if (row != home || col != 4 || attacked(board, row, col, !white)) return;
        boolean kingSide = white ? whiteKingSide : blackKingSide;
        boolean queenSide = white ? whiteQueenSide : blackQueenSide;
        if (kingSide && board[home][5] == '.' && board[home][6] == '.'
            && !attacked(board, home, 5, !white) && !attacked(board, home, 6, !white)) moves.add(new Move(row, col, home, 6, ' '));
        if (queenSide && board[home][3] == '.' && board[home][2] == '.' && board[home][1] == '.'
            && !attacked(board, home, 3, !white) && !attacked(board, home, 2, !white)) moves.add(new Move(row, col, home, 2, ' '));
    }

    /** 판에 수를 둔다(앙파상 잡기·캐슬링 룩 이동·프로모션 포함). 권리 갱신은 play에서 */
    private void applyTo(char[][] target, Move move) {
        char piece = target[move.fromRow()][move.fromCol()];
        boolean pawn = Character.toUpperCase(piece) == 'P';
        if (pawn && move.fromCol() != move.toCol() && target[move.toRow()][move.toCol()] == '.') {
            target[move.fromRow()][move.toCol()] = '.'; // 앙파상: 옆의 폰을 잡는다
        }
        if (Character.toUpperCase(piece) == 'K' && Math.abs(move.toCol() - move.fromCol()) == 2) {
            int rookFrom = move.toCol() == 6 ? 7 : 0;
            int rookTo = move.toCol() == 6 ? 5 : 3;
            target[move.fromRow()][rookTo] = target[move.fromRow()][rookFrom];
            target[move.fromRow()][rookFrom] = '.';
        }
        target[move.toRow()][move.toCol()] = move.promotion() != ' ' ? (isWhite(piece) ? move.promotion() : Character.toLowerCase(move.promotion())) : piece;
        target[move.fromRow()][move.fromCol()] = '.';
    }

    // ── 진행 ────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat > 1) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (!"MOVE".equals(action.actionName())) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        if ((seat == 0) != whiteToMove) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        List<Integer> numbers = action.numbers();
        if (numbers == null || numbers.size() != 4 || numbers.stream().anyMatch(number -> number == null)) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        char promotion = action.text() == null || action.text().isBlank() ? 'Q' : Character.toUpperCase(action.text().charAt(0));
        Move chosen = null;
        for (Move move : legalMoves()) {
            boolean same = move.fromRow() == numbers.get(0) && move.fromCol() == numbers.get(1) && move.toRow() == numbers.get(2) && move.toCol() == numbers.get(3);
            if (same && (move.promotion() == ' ' || move.promotion() == promotion)) chosen = move;
        }
        if (chosen == null) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "둘 수 없는 수입니다(내 킹이 공격받게 되는 수도 둘 수 없습니다).");
        play(chosen);
    }

    void play(Move move) {
        char piece = board[move.fromRow()][move.fromCol()];
        char target = board[move.toRow()][move.toCol()];
        boolean pawn = Character.toUpperCase(piece) == 'P';
        boolean passantCapture = pawn && move.fromCol() != move.toCol() && target == '.';
        char captured = passantCapture ? board[move.fromRow()][move.toCol()] : target;
        String notation = notation(move, piece, captured != '.');

        applyTo(board, move);
        if (captured != '.') (whiteToMove ? capturedByWhite : capturedByBlack).add(String.valueOf(captured));
        // 캐슬링 권리: 킹이 움직이거나, 룩이 움직이거나 잡히면 사라진다
        if (piece == 'K') { whiteKingSide = false; whiteQueenSide = false; }
        if (piece == 'k') { blackKingSide = false; blackQueenSide = false; }
        if (move.fromRow() == 7 && move.fromCol() == 7 || move.toRow() == 7 && move.toCol() == 7) whiteKingSide = false;
        if (move.fromRow() == 7 && move.fromCol() == 0 || move.toRow() == 7 && move.toCol() == 0) whiteQueenSide = false;
        if (move.fromRow() == 0 && move.fromCol() == 7 || move.toRow() == 0 && move.toCol() == 7) blackKingSide = false;
        if (move.fromRow() == 0 && move.fromCol() == 0 || move.toRow() == 0 && move.toCol() == 0) blackQueenSide = false;
        enPassant = pawn && Math.abs(move.toRow() - move.fromRow()) == 2 ? new int[] {(move.fromRow() + move.toRow()) / 2, move.fromCol()} : null;
        halfmoveClock = pawn || captured != '.' ? 0 : halfmoveClock + 1;
        lastMove = move;
        whiteToMove = !whiteToMove;
        int repeated = positions.merge(positionKey(), 1, Integer::sum);

        boolean check = inCheck(whiteToMove);
        boolean noMoves = legalMoves().isEmpty();
        if (noMoves && check) {
            history.add(notation + "#");
            end(whiteToMove ? 1 : 0, "체크메이트 — " + nicknames.get(whiteToMove ? 1 : 0) + " 승리");
            return;
        }
        history.add(notation + (check ? "+" : ""));
        if (check) announcements.add((whiteToMove ? "백" : "흑") + " 체크!");
        if (noMoves) end(null, "스테일메이트(둘 수가 없음) — 무승부");
        else if (halfmoveClock >= 100) end(null, "50수 동안 잡거나 폰을 움직이지 않아 무승부");
        else if (repeated >= 3) end(null, "같은 국면 3번 반복 — 무승부");
        else if (insufficientMaterial()) end(null, "체크메이트할 기물이 모자라 무승부");
    }

    private void end(Integer winner, String reason) {
        finished = true;
        winnerSeat = winner;
        result = reason;
    }

    /** 킹만 남았거나, 킹 + 비숍/나이트 하나만 남은 쪽뿐이면 체크메이트가 불가능하다 */
    private boolean insufficientMaterial() {
        int minorPieces = 0;
        for (char[] row : board) {
            for (char piece : row) {
                char upper = Character.toUpperCase(piece);
                if (upper == 'P' || upper == 'R' || upper == 'Q') return false;
                if (upper == 'B' || upper == 'N') minorPieces++;
            }
        }
        return minorPieces <= 1;
    }

    private String positionKey() {
        StringBuilder key = new StringBuilder();
        for (char[] row : board) key.append(row);
        key.append(whiteToMove ? 'w' : 'b').append(whiteKingSide).append(whiteQueenSide).append(blackKingSide).append(blackQueenSide);
        if (enPassant != null) key.append(enPassant[0]).append(enPassant[1]);
        return key.toString();
    }

    private static String square(int row, int col) {
        return "" + (char) ('a' + col) + (8 - row);
    }

    /** 간단한 기보: "e2-e4", 잡으면 "x", 캐슬링 "O-O", 프로모션 "=Q" */
    private static String notation(Move move, char piece, boolean capture) {
        if (Character.toUpperCase(piece) == 'K' && Math.abs(move.toCol() - move.fromCol()) == 2) return move.toCol() == 6 ? "O-O" : "O-O-O";
        String name = Character.toUpperCase(piece) == 'P' ? "" : String.valueOf(Character.toUpperCase(piece));
        return name + square(move.fromRow(), move.fromCol()) + (capture ? "x" : "-") + square(move.toRow(), move.toCol())
            + (move.promotion() != ' ' ? "=" + move.promotion() : "");
    }

    @Override
    public void leave(int seat) {
        if (finished) return;
        end(1 - seat, nicknames.get(seat) + " 기권·퇴장 — " + nicknames.get(1 - seat) + " 승리");
    }

    @Override
    public boolean isFinished() {
        return finished;
    }

    @Override
    public String resultText() {
        return "체스 " + (result == null ? "끝" : result);
    }

    @Override
    public Object viewFor(Integer seat) {
        List<String> rows = new ArrayList<>();
        for (char[] row : board) rows.add(new String(row));
        int turn = whiteToMove ? 0 : 1;
        List<List<Integer>> legal = !finished && seat != null && seat == turn
            ? legalMoves().stream().filter(move -> move.promotion() == ' ' || move.promotion() == 'Q')
                .map(move -> List.of(move.fromRow(), move.fromCol(), move.toRow(), move.toCol())).toList()
            : List.of();
        List<Integer> last = lastMove == null ? null : List.of(lastMove.fromRow(), lastMove.fromCol(), lastMove.toRow(), lastMove.toCol());
        String color = seat == null ? null : seat == 0 ? "WHITE" : seat == 1 ? "BLACK" : null;
        return new View(seat, color, rows, finished ? null : turn, !finished && inCheck(whiteToMove), last, legal, List.copyOf(history),
            List.copyOf(capturedByWhite), List.copyOf(capturedByBlack), winnerSeat, result, finished);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
