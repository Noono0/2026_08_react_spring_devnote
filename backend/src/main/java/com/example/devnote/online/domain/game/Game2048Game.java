package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Random;

/**
 * 2048 대전(2~4명). 각자 자기 4×4 판으로 동시에 겨룬다(차례 없음).
 *
 * [규칙] 혼자 하는 2048(game2048Logic.ts)과 같다.
 *   타일을 한 방향으로 밀면 같은 숫자가 합쳐져 두 배가 되고, 합친 숫자만큼 점수가 오른다.
 *   한 번 합쳐진 타일은 그 이동에서 다시 합쳐지지 않는다([2,2,2,2] → [4,4,0,0]).
 *   판이 실제로 바뀐 이동만 이동 수에 들어가고, 그 뒤에 빈칸 하나에 새 타일(90% 2, 10% 4)이 생긴다.
 *
 * [공정하게 — 같은 판, 같은 새 타일 순서]
 *   모두 같은 처음 판에서 시작한다. 새 타일은 자리마다 "같은 시드로 만든 난수"로 고르므로,
 *   두 사람이 똑같이 밀면 똑같은 타일이 똑같은 자리에 생긴다. 운이 아니라 실력으로 겨룬다.
 *
 * [끝과 순위] 방장이 고른 목표 타일(256~2048)을 만들면 성공, 더 밀 수 없으면 실패. 순위·승자는 RaceStandings 참고
 *   (성공은 적은 이동 수 → 먼저 끝낸 순, 실패는 높은 점수 순).
 *
 * [숨긴 정보 없음] 판은 비밀이 아니므로 모든 사람(관전자 포함)에게 모든 판을 보낸다.
 *
 * 행동 모양: { action: "MOVE", text: "UP" | "DOWN" | "LEFT" | "RIGHT" }
 */
public class Game2048Game implements OnlineGame {
    public static final int SIZE = 4;

    public enum Direction { UP, DOWN, LEFT, RIGHT }

    /** 자리 하나의 공개 정보. status: PLAYING·SUCCESS·FAILED·LEFT, rank는 끝난 뒤에만 */
    public record PlayerView(String nickname, List<List<Integer>> board, int score, int moves, String status, Integer finishOrder, Integer rank) {}

    public record View(Integer mySeat, int target, List<PlayerView> players, List<Integer> winners, boolean finished) {}

    /** 한 줄을 민 결과: 민 줄과 이번에 합쳐서 얻은 점수 */
    record LineResult(int[] line, int gained) {}

    /** 판 전체를 한 번 민 결과: 새 판, 얻은 점수, 판이 바뀌었는지 */
    record MoveResult(int[][] board, int gained, boolean moved) {}

    private final List<String> nicknames;
    private final int target;
    private final int[][][] boards;
    private final Random[] tileRandoms;
    private final int[] scores;
    private final int[] moves;
    private final RaceStandings standings;
    private final List<String> announcements = new ArrayList<>();

    public Game2048Game(List<String> nicknames, Random random, int target) {
        this(nicknames, target, createInitialBoard(random), random.nextLong());
    }

    /** 테스트용: 처음 판과 새 타일 시드를 정해 시작한다 */
    Game2048Game(List<String> nicknames, int target, int[][] initialBoard, long tileSeed) {
        this.nicknames = List.copyOf(nicknames);
        this.target = target;
        int seatCount = nicknames.size();
        this.boards = new int[seatCount][][];
        this.tileRandoms = new Random[seatCount];
        for (int seat = 0; seat < seatCount; seat++) {
            boards[seat] = copy(initialBoard);
            tileRandoms[seat] = new Random(tileSeed); // 자리마다 같은 시드 → 같은 순서의 새 타일
        }
        this.scores = new int[seatCount];
        this.moves = new int[seatCount];
        this.standings = new RaceStandings(seatCount);
    }

    private static int[][] createInitialBoard(Random random) {
        int[][] board = new int[SIZE][SIZE];
        addTile(board, random);
        addTile(board, random);
        return board;
    }

    @Override
    public void act(int seat, GameAction action) {
        if (!standings.isPlaying(seat)) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (!"MOVE".equals(action.actionName())) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        MoveResult result = slide(boards[seat], parseDirection(action.text()));
        if (!result.moved()) return; // 혼자 하기처럼 판이 그대로면 아무 일도 없다(이동 수에도 안 들어간다)

        boards[seat] = result.board();
        addTile(boards[seat], tileRandoms[seat]);
        scores[seat] += result.gained();
        moves[seat]++;
        if (hasTile(boards[seat], target)) {
            standings.succeed(seat);
            announcements.add(nicknames.get(seat) + "님이 " + target + " 타일을 만들었습니다! (" + moves[seat] + "번 이동)");
        } else if (!canMove(boards[seat])) {
            standings.fail(seat);
            announcements.add(nicknames.get(seat) + "님은 더 밀 수 없습니다. (점수 " + formatNumber(scores[seat]) + ")");
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
        return standings.winners(seat -> moves[seat], seat -> scores[seat]);
    }

    /** 예: "2048 대전(목표 512) 1위 철수 120번 만에 성공 · 2위 영희 1,234점 · 3위 민수 빠짐" */
    @Override
    public String resultText() {
        int[] ranks = standings.ranks(seat -> moves[seat], seat -> scores[seat]);
        List<Integer> order = new ArrayList<>();
        for (int seat = 0; seat < boards.length; seat++) order.add(seat);
        order.sort((left, right) -> Integer.compare(ranks[left], ranks[right]));
        List<String> parts = new ArrayList<>();
        for (int seat : order) parts.add(ranks[seat] + "위 " + nicknames.get(seat) + " " + describeResult(seat));
        return "2048 대전(목표 " + target + ") " + String.join(" · ", parts);
    }

    private String describeResult(int seat) {
        return switch (standings.statusOf(seat)) {
            case SUCCESS -> moves[seat] + "번 만에 성공";
            case LEFT -> "빠짐";
            case FAILED, PLAYING -> formatNumber(scores[seat]) + "점";
        };
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean isPlayer = seat != null && seat >= 0 && seat < boards.length;
        int[] ranks = standings.isFinished() ? standings.ranks(index -> moves[index], index -> scores[index]) : null;
        List<PlayerView> players = new ArrayList<>();
        for (int index = 0; index < boards.length; index++) {
            players.add(new PlayerView(
                nicknames.get(index), rowsOf(boards[index]), scores[index], moves[index], standings.statusOf(index).name(),
                standings.finishOrderOf(index), ranks == null ? null : ranks[index]));
        }
        return new View(isPlayer ? seat : null, target, players, winnerSeats(), standings.isFinished());
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }

    // ── 판 규칙(순수 함수) ───────────────────────────────────────────

    /**
     * 한 줄을 "앞쪽"(index 0)으로 민다. 혼자 하기 slideRow와 같은 방법:
     *   빈칸을 빼고 숫자만 모은 뒤, 앞에서부터 같은 두 수를 한 번씩 합치고, 남은 칸을 0으로 채운다.
     */
    static LineResult slideLine(int[] line) {
        int[] tiles = Arrays.stream(line).filter(value -> value != 0).toArray();
        int[] slid = new int[line.length];
        int write = 0;
        int gained = 0;
        for (int index = 0; index < tiles.length; index++) {
            if (index + 1 < tiles.length && tiles[index] == tiles[index + 1]) {
                slid[write++] = tiles[index] * 2;
                gained += tiles[index] * 2;
                index++; // 합친 다음 칸은 건너뛴다(한 번만 합쳐지게)
            } else {
                slid[write++] = tiles[index];
            }
        }
        return new LineResult(slid, gained);
    }

    /**
     * 판 전체를 한 방향으로 민다(원래 판은 그대로, 새 판을 돌려준다).
     * 방향마다 "미는 쪽이 index 0"이 되도록 줄을 읽어 slideLine으로 밀고 같은 순서로 다시 쓴다.
     */
    static MoveResult slide(int[][] board, Direction direction) {
        int[][] next = new int[SIZE][SIZE];
        int gained = 0;
        for (int line = 0; line < SIZE; line++) {
            int[] cells = new int[SIZE];
            for (int index = 0; index < SIZE; index++) {
                int[] position = position(direction, line, index);
                cells[index] = board[position[0]][position[1]];
            }
            LineResult slid = slideLine(cells);
            gained += slid.gained();
            for (int index = 0; index < SIZE; index++) {
                int[] position = position(direction, line, index);
                next[position[0]][position[1]] = slid.line()[index];
            }
        }
        return new MoveResult(next, gained, !Arrays.deepEquals(board, next));
    }

    /** direction으로 밀 때 line번째 줄의 index번째 칸 위치 {행, 열}. index 0이 미는 쪽 끝이다 */
    private static int[] position(Direction direction, int line, int index) {
        return switch (direction) {
            case LEFT -> new int[] {line, index};
            case RIGHT -> new int[] {line, SIZE - 1 - index};
            case UP -> new int[] {index, line};
            case DOWN -> new int[] {SIZE - 1 - index, line};
        };
    }

    /** 빈칸 하나에 새 타일(90% 2, 10% 4). 판이 바뀐 이동 뒤에는 빈칸이 늘 하나 이상 있다 */
    static void addTile(int[][] board, Random random) {
        List<int[]> empty = new ArrayList<>();
        for (int row = 0; row < SIZE; row++) for (int col = 0; col < SIZE; col++) if (board[row][col] == 0) empty.add(new int[] {row, col});
        if (empty.isEmpty()) return;
        int[] cell = empty.get(random.nextInt(empty.size()));
        board[cell[0]][cell[1]] = random.nextInt(10) < 9 ? 2 : 4;
    }

    /** 빈칸이 있거나 가로·세로로 이웃한 같은 숫자가 있으면 아직 밀 수 있다 */
    static boolean canMove(int[][] board) {
        for (int row = 0; row < SIZE; row++) {
            for (int col = 0; col < SIZE; col++) {
                int value = board[row][col];
                if (value == 0) return true;
                if (col + 1 < SIZE && board[row][col + 1] == value) return true;
                if (row + 1 < SIZE && board[row + 1][col] == value) return true;
            }
        }
        return false;
    }

    private static boolean hasTile(int[][] board, int value) {
        return Arrays.stream(board).flatMapToInt(Arrays::stream).anyMatch(tile -> tile >= value);
    }

    private static Direction parseDirection(String text) {
        for (Direction direction : Direction.values()) if (direction.name().equals(text)) return direction;
        throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "UP·DOWN·LEFT·RIGHT 중 한 방향으로 밀어 주세요.");
    }

    private static List<List<Integer>> rowsOf(int[][] board) {
        return Arrays.stream(board).map(row -> Arrays.stream(row).boxed().toList()).toList();
    }

    private static int[][] copy(int[][] board) {
        return Arrays.stream(board).map(int[]::clone).toArray(int[][]::new);
    }

    private static String formatNumber(int value) {
        return NumberFormat.getIntegerInstance(Locale.KOREA).format(value);
    }
}
