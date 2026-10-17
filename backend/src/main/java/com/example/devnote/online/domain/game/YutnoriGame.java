package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import java.util.function.Supplier;

/**
 * 윷놀이(2~4명). 서버가 윷을 던지고, 말이 갈 수 있는 곳을 계산해 화면에 알려 준다.
 *
 * [윷 결과] 윷가락 4개 중 평평한 면이 위로 온 개수: 1=도(1칸) 2=개(2칸) 3=걸(3칸) 4=윷(4칸) 0=모(5칸)
 *   윷·모가 나오면 한 번 더 던진다. 던진 결과는 모아 두었다가(pendingThrows) 하나씩 골라 말을 옮긴다.
 *   ★ 학습용으로 빽도(뒤로 1칸)는 넣지 않았다. 가운데 칸처럼 들어오는 길이 둘인 칸에서 "뒤"가 어디인지 정하는 규칙이 따로 필요하기 때문이다.
 *
 * [판 번호] 0 = 아직 판에 오르지 않은 말, 30 = 다 돈 말(났음)
 *   바깥 길: 1~19, 20 = 출발점(참먹이). 모서리 5·10·15
 *   지름길: 5 → 21 → 22 → 23(가운데 방) → 24 → 25 → 15
 *           10 → 26 → 27 → 23(가운데 방) → 28 → 29 → 20
 *   모서리(5·10)나 가운데(23)에 "딱 멈추면" 다음 차례에 지름길로 들어간다. 지나가기만 하면 바깥 길을 그대로 간다.
 *   20(참먹이)에 딱 멈춘 말은 아직 나지 않았다. 다음에 몇 칸이든 움직이면 난다.
 *
 * [잡기·업기] 상대 말이 있는 칸에 멈추면 그 말(업힌 말 전부)은 처음으로 돌아가고, 나는 한 번 더 던진다.
 *   내 말끼리 같은 칸에 모이면 업혀서 함께 움직인다.
 * [승리] 내 말이 모두 나면 이긴다(가장 먼저 난 한 명만 승리).
 */
public class YutnoriGame implements OnlineGame {
    public static final int WAITING = 0;
    public static final int START_CORNER = 20;
    public static final int FINISHED = 30;
    private static final int CENTER = 23;

    public enum Throw {
        DO("도", 1), GAE("개", 2), GEOL("걸", 3), YUT("윷", 4), MO("모", 5);

        private final String label;
        private final int steps;

        Throw(String label, int steps) {
            this.label = label;
            this.steps = steps;
        }

        public String label() {
            return label;
        }

        public int steps() {
            return steps;
        }

        /** 윷·모는 한 번 더 던진다 */
        public boolean throwsAgain() {
            return this == YUT || this == MO;
        }

        /** 평평한 면이 위로 온 윷가락 수(0~4) → 결과 */
        static Throw fromFlatCount(int flatCount) {
            return switch (flatCount) {
                case 1 -> DO;
                case 2 -> GAE;
                case 3 -> GEOL;
                case 4 -> YUT;
                default -> MO;
            };
        }
    }

    public enum Phase { THROW, MOVE, END }

    /** 지금 차례인 사람에게만 보내는 "이렇게 옮길 수 있다" 목록. destination이 30이면 그 말이 난다 */
    public record MoveOption(int piece, int throwIndex, int destination) {}

    public record View(Integer mySeat, int turnSeat, Phase phase, List<String> pendingThrows, List<List<Integer>> pieces,
                       List<Boolean> active, List<MoveOption> moves, List<String> log, Integer winnerSeat, boolean finished) {}

    // ── 길(route) ─────────────────────────────────────────────────────
    // 말이 지금 서 있는 칸으로 "어느 길을 따라갈지" 정하고, 그 길에서 칸 수만큼 앞으로 간다.
    private static final int[] OUTER_ROUTE = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20};
    private static final int[] FROM_FIRST_CORNER = {5, 21, 22, 23, 24, 25, 15, 16, 17, 18, 19, 20};
    private static final int[] FROM_SECOND_CORNER = {10, 26, 27, 23, 28, 29, 20};
    private static final int[] FROM_CENTER = {23, 28, 29, 20};

    private final List<String> nicknames;
    /** pieces[자리][말 번호] = 칸 번호 */
    private final int[][] pieces;
    private final boolean[] active;
    private final Supplier<Throw> thrower;
    private final List<Throw> pendingThrows = new ArrayList<>();
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.THROW;
    private int turnSeat;
    /** 상대 말을 잡아서 얻은 "한 번 더" 횟수. 모아 둔 결과를 다 쓴 뒤에 던진다 */
    private int bonusThrows;
    private Integer winnerSeat;

    public YutnoriGame(List<String> nicknames, Random random, int pieceCount) {
        this(nicknames, pieceCount, () -> {
            int flatCount = 0;
            for (int stick = 0; stick < 4; stick++) if (random.nextBoolean()) flatCount++;
            return Throw.fromFlatCount(flatCount);
        });
    }

    /** 테스트용: 윷 결과를 정해 둔 순서대로 내놓는다 */
    YutnoriGame(List<String> nicknames, int pieceCount, Supplier<Throw> thrower) {
        if (nicknames.size() < 2 || nicknames.size() > 4) throw new IllegalArgumentException("윷놀이는 2~4명이 합니다.");
        if (pieceCount < 1 || pieceCount > 4) throw new IllegalArgumentException("말은 1~4개입니다.");
        this.nicknames = List.copyOf(nicknames);
        this.pieces = new int[nicknames.size()][pieceCount];
        this.active = new boolean[nicknames.size()];
        Arrays.fill(active, true);
        this.thrower = thrower;
        say("윷놀이 시작! 말 " + pieceCount + "개를 모두 먼저 내보내면 이깁니다. " + nicknames.get(0) + " 님부터 던지세요.");
    }

    /** 말 개수 옵션("4"·"2") → 숫자. OnlineGameType이 고를 수 있는 값을 이미 검사했다 */
    public static int pieceCountFor(String option) {
        return option == null ? 4 : Integer.parseInt(option);
    }

    /** 채팅에도 알릴 큰 사건(시작·잡기·승리·나감) */
    private void say(String text) {
        announcements.add(text);
        note(text);
    }

    /** 게임 화면의 기록에만 남기는 작은 사건(던지기·이동). 매번 채팅에 올리면 대화가 묻힌다 */
    private void note(String text) {
        log.add(text);
        if (log.size() > 20) log.remove(0);
    }

    // ── 길 계산 ──────────────────────────────────────────────────────

    static int[] routeFor(int node) {
        if (node == 5 || node == 21 || node == 22 || node == 24 || node == 25) return FROM_FIRST_CORNER;
        if (node == 10 || node == 26 || node == 27) return FROM_SECOND_CORNER;
        if (node == CENTER || node == 28 || node == 29) return FROM_CENTER;
        return OUTER_ROUTE;
    }

    /** node에서 steps칸 갔을 때 도착하는 칸. 길 끝(20)을 넘으면 났다(30) */
    static int destination(int node, int steps) {
        int[] route = routeFor(node);
        int index = 0;
        while (route[index] != node) index++;
        int target = index + steps;
        return target >= route.length ? FINISHED : route[target];
    }

    // ── 진행 ─────────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.END || seat < 0 || seat >= pieces.length) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        switch (action.actionName()) {
            case "THROW" -> throwYut();
            case "MOVE" -> move(action.numbers());
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void throwYut() {
        if (phase != Phase.THROW) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "먼저 나온 결과로 말을 옮겨 주세요.");
        Throw result = thrower.get();
        pendingThrows.add(result);
        if (result.throwsAgain()) {
            note(nicknames.get(turnSeat) + ": " + result.label() + "! 한 번 더 던지세요.");
        } else {
            note(nicknames.get(turnSeat) + ": " + result.label());
            phase = Phase.MOVE;
        }
    }

    /** numbers = [말 번호, 쓸 결과의 번호(pendingThrows 안의 위치)] */
    private void move(List<Integer> numbers) {
        if (phase != Phase.MOVE) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "윷을 먼저 던져 주세요.");
        if (numbers == null || numbers.size() != 2 || numbers.get(0) == null || numbers.get(1) == null) {
            throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
        int piece = numbers.get(0);
        int throwIndex = numbers.get(1);
        int[] myPieces = pieces[turnSeat];
        if (piece < 0 || piece >= myPieces.length || myPieces[piece] == FINISHED) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "움직일 수 있는 말을 골라 주세요.");
        }
        if (throwIndex < 0 || throwIndex >= pendingThrows.size()) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "쓸 윷 결과를 골라 주세요.");

        Throw used = pendingThrows.remove(throwIndex);
        int from = myPieces[piece];
        int to = destination(from, used.steps());
        // ★ 업기: 판 위에서 같은 칸에 있는 내 말은 함께 움직인다. 기다리는 말(0)은 하나씩만 나간다.
        int movedCount = 0;
        for (int index = 0; index < myPieces.length; index++) {
            if (index == piece || (from != WAITING && myPieces[index] == from)) {
                myPieces[index] = to;
                movedCount++;
            }
        }
        String pieceText = movedCount > 1 ? "말 " + movedCount + "개(업힘)" : "말";
        if (to == FINISHED) {
            // "말이 났습니다", "말 2개(업힘)이 났습니다" — 두 경우 모두 받침이 있어 조사는 "이"
            note(nicknames.get(turnSeat) + "의 " + pieceText + "이 났습니다! (" + used.label() + ")");
        } else {
            note(nicknames.get(turnSeat) + "의 " + pieceText + " " + used.label() + " → " + to + "번 칸");
            captureAt(to);
        }

        if (Arrays.stream(myPieces).allMatch(node -> node == FINISHED)) {
            finish(turnSeat);
            return;
        }
        if (!pendingThrows.isEmpty()) return;
        if (bonusThrows > 0) {
            bonusThrows--;
            phase = Phase.THROW;
            note(nicknames.get(turnSeat) + " 님이 상대 말을 잡아 한 번 더 던집니다.");
        } else {
            passTurn();
        }
    }

    private void captureAt(int node) {
        for (int other = 0; other < pieces.length; other++) {
            if (other == turnSeat || !active[other]) continue;
            int captured = 0;
            for (int index = 0; index < pieces[other].length; index++) {
                if (pieces[other][index] == node) {
                    pieces[other][index] = WAITING;
                    captured++;
                }
            }
            if (captured > 0) {
                bonusThrows++;
                say(nicknames.get(turnSeat) + " 님이 " + nicknames.get(other) + "의 말 " + captured + "개를 잡았습니다!");
            }
        }
    }

    private void passTurn() {
        pendingThrows.clear();
        bonusThrows = 0;
        phase = Phase.THROW;
        int next = turnSeat;
        do {
            next = (next + 1) % pieces.length;
        } while (!active[next]);
        turnSeat = next;
    }

    private void finish(int winner) {
        winnerSeat = winner;
        phase = Phase.END;
        pendingThrows.clear();
        say(nicknames.get(winner) + " 님이 말을 모두 내보내 승리했습니다!");
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.END || seat < 0 || seat >= pieces.length || !active[seat]) return;
        active[seat] = false;
        Arrays.fill(pieces[seat], WAITING);
        say(nicknames.get(seat) + " 님이 나가서 말을 모두 거뒀습니다.");
        List<Integer> remaining = new ArrayList<>();
        for (int other = 0; other < active.length; other++) if (active[other]) remaining.add(other);
        if (remaining.size() == 1) {
            finish(remaining.get(0));
            return;
        }
        if (seat == turnSeat) passTurn();
    }

    /** 지금 차례인 사람이 고를 수 있는 이동. 같은 칸에 업힌 말과 기다리는 말은 대표 하나만 보여 준다 */
    private List<MoveOption> moveOptions() {
        if (phase != Phase.MOVE) return List.of();
        int[] myPieces = pieces[turnSeat];
        List<MoveOption> options = new ArrayList<>();
        for (int throwIndex = 0; throwIndex < pendingThrows.size(); throwIndex++) {
            List<Integer> seenNodes = new ArrayList<>();
            for (int piece = 0; piece < myPieces.length; piece++) {
                int node = myPieces[piece];
                if (node == FINISHED || seenNodes.contains(node)) continue;
                seenNodes.add(node);
                options.add(new MoveOption(piece, throwIndex, destination(node, pendingThrows.get(throwIndex).steps())));
            }
        }
        return List.copyOf(options);
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.END;
    }

    @Override
    public String resultText() {
        return winnerSeat == null ? "윷놀이 끝" : "윷놀이 " + nicknames.get(winnerSeat) + " 승리";
    }

    @Override
    public List<Integer> winnerSeats() {
        return winnerSeat == null ? List.of() : List.of(winnerSeat);
    }

    /** 윷놀이에는 숨길 정보가 없다. 다만 "옮길 수 있는 곳" 목록은 차례인 사람에게만 보낸다 */
    @Override
    public Object viewFor(Integer seat) {
        boolean player = seat != null && seat >= 0 && seat < pieces.length;
        List<List<Integer>> pieceView = new ArrayList<>();
        for (int[] seatPieces : pieces) pieceView.add(Arrays.stream(seatPieces).boxed().toList());
        List<Boolean> activeView = new ArrayList<>();
        for (boolean value : active) activeView.add(value);
        return new View(player ? seat : null, turnSeat, phase, pendingThrows.stream().map(Enum::name).toList(), pieceView,
            activeView, player && seat == turnSeat ? moveOptions() : List.of(), List.copyOf(log), winnerSeat, phase == Phase.END);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
