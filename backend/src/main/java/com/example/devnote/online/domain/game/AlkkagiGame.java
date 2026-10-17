package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.List;

/**
 * 알까기(2명). 바둑판 위에서 내 알을 손가락으로 튕겨 상대 알을 판 밖으로 떨어뜨린다.
 * 0번 자리 = 흑(아래쪽, 먼저), 1번 자리 = 백(위쪽).
 *
 * [방 옵션 — 정석·커스텀]
 *   STANDARD : 정석. 알 8개씩, 자기 쪽 한 줄에 같은 간격으로 놓고 바로 시작한다.
 *   CUSTOM_n : 커스텀. 각자 "최대 n개"까지 자기 쪽 절반(흑 = 아래 10~18줄, 백 = 위 0~8줄)의 바둑판 교차점에 마음대로 놓는다.
 *     PLACE [칸, 줄] = 그 점에 놓기(이미 내 알이 있으면 빼기) · CLEAR = 모두 빼기 · READY = 배치 완료(1개 이상, 이후 못 바꿈)
 *     ★ 둘 다 완료할 때까지 상대 배치는 보내지 않는다(viewFor). 먼저 놓은 사람의 배치를 보고 따라 하지 못하게 하려는 것이다.
 *
 * [튕기기] FLICK numbers = [내 알 번호, 각도(0~359도, 0 = 오른쪽, 90 = 위쪽), 힘(5~100)]
 *   서버가 마찰·충돌·떨어짐을 계산하고(아래 [물리]) 그 궤적을 1/30초 프레임으로 모두에게 보낸다.
 *   모두가 같은 궤적을 재생하므로 화면마다 결과가 달라지지 않는다(당구 BilliardsPhysics와 같은 방식).
 * [차례] 상대 알을 하나 이상 떨어뜨리고 내 알은 하나도 안 떨어졌으면 한 번 더, 아니면 상대 차례.
 * [승패] 한쪽 알이 모두 떨어지면 남은 쪽이 이긴다(둘 다 없으면 무승부). 60번 튕기면 남은 알 수로 정한다.
 *
 * [물리 — 학습용으로 단순화]
 *   판은 1000×1000, 알은 반지름 24의 같은 무게 원판. 1/240초마다
 *     1) 움직이는 알은 속력을 일정하게 줄인다(마찰 감속)  2) 겹친 두 알은 중심을 잇는 방향으로 속도를 주고받는다(반발 0.9)
 *     3) 중심이 판 밖으로 나간 알은 떨어진다.  모든 알이 멈추면 끝.
 *   난수가 없으므로 같은 판에서 같은 각도·힘이면 언제나 같은 결과다(테스트로 확인).
 */
public class AlkkagiGame implements OnlineGame {
    public static final int BOARD_SIZE = 1000;
    public static final int STONE_RADIUS = 24;
    public static final int MAX_SHOTS = 60;
    static final double MAX_SPEED = 2000;      // 힘 100일 때 처음 속력(판 단위/초)
    static final double FRICTION = 900;        // 마찰 감속(판 단위/초²)
    static final double RESTITUTION = 0.9;
    private static final double STEP = 1.0 / 240;
    private static final int STEPS_PER_FRAME = 8; // 240 ÷ 8 = 30프레임/초
    private static final double MAX_SECONDS = 12;
    /** 정석 알 수 */
    public static final int STANDARD_STONES = 8;
    /** 바둑판 19줄: 교차점 (칸, 줄) → 좌표 (50 + 50 × 칸, 50 + 50 × 줄) */
    public static final int GRID_LINES = 19;
    public static final int GRID_START = 50;
    public static final int GRID_STEP = 50;

    public enum Phase { SETUP, PLAY, END }

    /** 알 하나. side 0 = 흑, 1 = 백. alive = 판 위에 남아 있는지 */
    public record Stone(int side, int x, int y, boolean alive) {}

    /** 마지막 튕기기: seq가 바뀌면 화면이 frames를 재생한다. frames[n] = [x0, y0, x1, y1, ...], 떨어진 알은 -1 */
    public record Shot(int seq, int shooterSeat, int stone, int angle, int power, List<List<Integer>> frames, int knockedOpponent, int knockedOwn) {}

    /**
     * mode: STANDARD(정석)·CUSTOM(커스텀). maxStones: 커스텀에서 놓을 수 있는 최대 개수(정석은 알 수)
     * SETUP 동안 stones에는 내가 놓은 알만 들어 있고, 상대는 placedCounts(개수)와 ready(완료 여부)만 보인다.
     */
    public record View(Integer mySeat, String mode, Phase phase, int maxStones, List<Integer> placedCounts, List<Boolean> ready,
                       int turnSeat, List<Stone> stones, List<Integer> remaining, int shotCount,
                       Shot lastShot, List<String> log, Integer winnerSeat, boolean finished) {}

    private final List<String> nicknames;
    private final boolean custom;
    private final int maxStones;
    /** 커스텀 배치 단계: 자리마다 놓은 교차점 [칸, 줄] 목록 */
    private final List<List<int[]>> placed = List.of(new ArrayList<>(), new ArrayList<>());
    private final boolean[] ready = new boolean[2];
    // 대국이 시작되면 채워지는 알 정보(흑 알 먼저, 그다음 백 알)
    private double[] x = new double[0];
    private double[] y = new double[0];
    private int[] sides = new int[0];
    private boolean[] alive = new boolean[0];
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.PLAY;
    private int turnSeat;
    private int shotCount;
    private Shot lastShot;
    private Integer winnerSeat;
    private boolean draw;

    /** 정석: 알 stonesPerSide개씩 자기 쪽 한 줄에 같은 간격으로 놓고 바로 시작한다 */
    public AlkkagiGame(List<String> nicknames, int stonesPerSide) {
        if (nicknames.size() != 2) throw new IllegalArgumentException("알까기는 2명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        this.custom = false;
        this.maxStones = stonesPerSide;
        List<int[]> stones = new ArrayList<>();
        for (int side = 0; side < 2; side++) {
            for (int order = 0; order < stonesPerSide; order++) {
                stones.add(new int[]{side, (int) Math.round(BOARD_SIZE * (order + 1.0) / (stonesPerSide + 1)), side == 0 ? 800 : 200});
            }
        }
        placeStones(stones);
        say("알까기(정석) 시작! 흑(" + nicknames.get(0) + ") 알 " + stonesPerSide + "개 vs 백(" + nicknames.get(1) + ") 알 " + stonesPerSide + "개. 흑부터 튕기세요.");
    }

    /** 커스텀: 각자 최대 maxStones개를 자기 쪽 절반에 놓는 배치 단계부터 시작한다 */
    private AlkkagiGame(List<String> nicknames, int maxStones, boolean custom) {
        if (nicknames.size() != 2) throw new IllegalArgumentException("알까기는 2명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        this.custom = custom;
        this.maxStones = maxStones;
        this.phase = Phase.SETUP;
        say("알까기(커스텀) 시작! 각자 자기 쪽 절반에 알을 최대 " + maxStones + "개까지 놓고 '배치 완료'를 누르세요.");
    }

    /** 테스트용: 알 위치를 직접 놓는다. stones = [side, x, y] 목록 */
    AlkkagiGame(List<String> nicknames, List<int[]> stones) {
        this.nicknames = List.copyOf(nicknames);
        this.custom = false;
        this.maxStones = stones.size();
        placeStones(stones);
    }

    /** 방 옵션 → 게임. "STANDARD" = 정석, "CUSTOM_n" = 최대 n개 커스텀 배치. 옵션이 없으면 정석 */
    public static AlkkagiGame create(List<String> nicknames, String option) {
        if (option == null || option.equals("STANDARD")) return new AlkkagiGame(nicknames, STANDARD_STONES);
        return new AlkkagiGame(nicknames, Integer.parseInt(option.substring("CUSTOM_".length())), true);
    }

    private void placeStones(List<int[]> stones) {
        int total = stones.size();
        x = new double[total];
        y = new double[total];
        sides = new int[total];
        alive = new boolean[total];
        for (int index = 0; index < total; index++) {
            sides[index] = stones.get(index)[0];
            x[index] = stones.get(index)[1];
            y[index] = stones.get(index)[2];
            alive[index] = true;
        }
    }

    // ── 커스텀 배치 ──────────────────────────────────────────────────

    /** 자기 쪽 절반인지: 흑 = 아래 10~18줄, 백 = 위 0~8줄(가운데 9줄은 어느 쪽도 아님) */
    static boolean isOwnHalf(int side, int row) {
        return side == 0 ? row >= 10 && row < GRID_LINES : row >= 0 && row <= 8;
    }

    private void setupAction(int seat, GameAction action) {
        if (ready[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이미 배치를 마쳤습니다.");
        List<int[]> mine = placed.get(seat);
        switch (action.actionName()) {
            case "PLACE" -> {
                List<Integer> numbers = action.numbers();
                if (numbers == null || numbers.size() != 2 || numbers.stream().anyMatch(java.util.Objects::isNull)) {
                    throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
                }
                int col = numbers.get(0);
                int row = numbers.get(1);
                if (col < 0 || col >= GRID_LINES || !isOwnHalf(seat, row)) {
                    throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "내 쪽 절반의 교차점에만 놓을 수 있습니다.");
                }
                // ★ 같은 점을 다시 누르면 뺀다(토글). 화면에 "빼기" 버튼을 따로 두지 않아도 된다
                boolean removed = mine.removeIf(point -> point[0] == col && point[1] == row);
                if (removed) return;
                if (mine.size() >= maxStones) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "알은 최대 " + maxStones + "개까지 놓을 수 있습니다.");
                mine.add(new int[]{col, row});
            }
            case "CLEAR" -> mine.clear();
            case "READY" -> {
                if (mine.isEmpty()) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "알을 1개 이상 놓아 주세요.");
                ready[seat] = true;
                note((seat == 0 ? "흑" : "백") + " " + nicknames.get(seat) + " 님 배치 완료(" + mine.size() + "개)");
                if (ready[0] && ready[1]) startCustomPlay();
            }
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void startCustomPlay() {
        List<int[]> stones = new ArrayList<>();
        for (int side = 0; side < 2; side++) {
            for (int[] point : placed.get(side)) stones.add(new int[]{side, GRID_START + GRID_STEP * point[0], GRID_START + GRID_STEP * point[1]});
        }
        placeStones(stones);
        phase = Phase.PLAY;
        say("배치 끝! 흑 " + placed.get(0).size() + "개 vs 백 " + placed.get(1).size() + "개. 흑부터 튕기세요.");
    }

    private void say(String text) {
        announcements.add(text);
        note(text);
    }

    private void note(String text) {
        log.add(text);
        if (log.size() > 20) log.remove(0);
    }

    // ── 진행 ─────────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.END || seat < 0 || seat > 1) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (phase == Phase.SETUP) {
            // 배치는 차례 없이 둘이 동시에 한다
            setupAction(seat, action);
            return;
        }
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        if (!action.actionName().equals("FLICK")) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        List<Integer> numbers = action.numbers();
        if (numbers == null || numbers.size() != 3 || numbers.stream().anyMatch(java.util.Objects::isNull)) {
            throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
        int stone = numbers.get(0);
        int angle = numbers.get(1);
        int power = numbers.get(2);
        if (stone < 0 || stone >= alive.length || !alive[stone] || sides[stone] != seat) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "판 위에 있는 내 알을 골라 주세요.");
        }
        if (angle < 0 || angle > 359 || power < 5 || power > 100) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "각도는 0~359, 힘은 5~100으로 정해 주세요.");
        }
        flick(seat, stone, angle, power);
    }

    private void flick(int seat, int stone, int angle, int power) {
        boolean[] before = alive.clone();
        List<List<Integer>> frames = simulate(stone, angle, power);
        int knockedOpponent = 0;
        int knockedOwn = 0;
        for (int index = 0; index < alive.length; index++) {
            if (before[index] && !alive[index]) {
                if (sides[index] == seat) knockedOwn++;
                else knockedOpponent++;
            }
        }
        shotCount++;
        lastShot = new Shot(shotCount, seat, stone, angle, power, frames, knockedOpponent, knockedOwn);
        String name = (seat == 0 ? "흑 " : "백 ") + nicknames.get(seat);
        note(shotCount + ". " + name + ": 상대 알 " + knockedOpponent + "개" + (knockedOwn > 0 ? ", 내 알 " + knockedOwn + "개" : "") + " 떨어짐");
        if (knockedOpponent > 0) say(name + " 님이 상대 알 " + knockedOpponent + "개를 떨어뜨렸습니다!");

        int mine = remaining(seat);
        int theirs = remaining(1 - seat);
        if (mine == 0 || theirs == 0) {
            if (mine == 0 && theirs == 0) draw = true;
            else winnerSeat = mine == 0 ? 1 - seat : seat;
            finish();
            return;
        }
        if (shotCount >= MAX_SHOTS) {
            if (mine == theirs) draw = true;
            else winnerSeat = mine > theirs ? seat : 1 - seat;
            finish();
            return;
        }
        boolean again = knockedOpponent > 0 && knockedOwn == 0;
        if (again) note(name + " 님이 한 번 더 튕깁니다.");
        else turnSeat = 1 - seat;
    }

    private void finish() {
        phase = Phase.END;
        say(draw ? "알까기 무승부" : nicknames.get(winnerSeat) + " 님 승리! (남은 알 " + remaining(winnerSeat) + "개)");
    }

    int remaining(int side) {
        int count = 0;
        for (int index = 0; index < alive.length; index++) if (alive[index] && sides[index] == side) count++;
        return count;
    }

    // ── 물리 ─────────────────────────────────────────────────────────

    /** 한 번 튕긴 뒤 모든 알이 멈출 때까지 계산하고, 1/30초마다의 위치(프레임)를 돌려준다 */
    List<List<Integer>> simulate(int stone, int angle, int power) {
        int count = alive.length;
        double[] vx = new double[count];
        double[] vy = new double[count];
        double speed = MAX_SPEED * power / 100.0;
        double radians = Math.toRadians(angle);
        vx[stone] = Math.cos(radians) * speed;
        vy[stone] = -Math.sin(radians) * speed; // 화면 좌표는 아래로 갈수록 y가 커지므로 "위쪽(90도)"은 -y
        List<List<Integer>> frames = new ArrayList<>();
        frames.add(snapshot());
        int maxSteps = (int) (MAX_SECONDS / STEP);
        for (int step = 1; step <= maxSteps; step++) {
            boolean moving = false;
            for (int index = 0; index < count; index++) {
                if (!alive[index]) continue;
                double currentSpeed = Math.hypot(vx[index], vy[index]);
                if (currentSpeed < 1e-9) continue;
                // 1) 마찰: 속력을 일정량 줄인다(0 밑으로는 내려가지 않음)
                double slowed = Math.max(0, currentSpeed - FRICTION * STEP);
                vx[index] *= slowed / currentSpeed;
                vy[index] *= slowed / currentSpeed;
                x[index] += vx[index] * STEP;
                y[index] += vy[index] * STEP;
                if (slowed > 0) moving = true;
            }
            collide(vx, vy);
            // 3) 판 밖으로 나간 알은 떨어진다
            for (int index = 0; index < count; index++) {
                if (alive[index] && (x[index] < 0 || x[index] > BOARD_SIZE || y[index] < 0 || y[index] > BOARD_SIZE)) {
                    alive[index] = false;
                    vx[index] = 0;
                    vy[index] = 0;
                }
            }
            if (step % STEPS_PER_FRAME == 0) frames.add(snapshot());
            if (!moving) break;
        }
        frames.add(snapshot());
        return frames;
    }

    /** 2) 겹친 두 알: 중심을 잇는 방향의 속도를 주고받고, 겹친 만큼 반씩 밀어낸다(같은 무게) */
    private void collide(double[] vx, double[] vy) {
        double minDistance = STONE_RADIUS * 2.0;
        for (int first = 0; first < alive.length; first++) {
            if (!alive[first]) continue;
            for (int second = first + 1; second < alive.length; second++) {
                if (!alive[second]) continue;
                double dx = x[second] - x[first];
                double dy = y[second] - y[first];
                double distance = Math.hypot(dx, dy);
                if (distance >= minDistance || distance < 1e-9) continue;
                double nx = dx / distance;
                double ny = dy / distance;
                double overlap = (minDistance - distance) / 2;
                x[first] -= nx * overlap;
                y[first] -= ny * overlap;
                x[second] += nx * overlap;
                y[second] += ny * overlap;
                double approaching = (vx[first] - vx[second]) * nx + (vy[first] - vy[second]) * ny;
                if (approaching <= 0) continue; // 이미 멀어지는 중이면 속도는 그대로
                double impulse = (1 + RESTITUTION) / 2 * approaching;
                vx[first] -= impulse * nx;
                vy[first] -= impulse * ny;
                vx[second] += impulse * nx;
                vy[second] += impulse * ny;
            }
        }
    }

    private List<Integer> snapshot() {
        List<Integer> frame = new ArrayList<>();
        for (int index = 0; index < alive.length; index++) {
            frame.add(alive[index] ? (int) Math.round(x[index]) : -1);
            frame.add(alive[index] ? (int) Math.round(y[index]) : -1);
        }
        return List.copyOf(frame);
    }

    // ── 공통 ─────────────────────────────────────────────────────────

    @Override
    public void leave(int seat) {
        if (phase == Phase.END || seat < 0 || seat > 1) return;
        winnerSeat = 1 - seat;
        phase = Phase.END;
        say(nicknames.get(seat) + " 님이 나가 " + nicknames.get(winnerSeat) + " 님 승리");
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.END;
    }

    @Override
    public String resultText() {
        if (draw) return "알까기 무승부";
        return winnerSeat == null ? "알까기 끝" : "알까기 " + nicknames.get(winnerSeat) + " 승리";
    }

    @Override
    public List<Integer> winnerSeats() {
        return winnerSeat == null ? List.of() : List.of(winnerSeat);
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean player = seat != null && (seat == 0 || seat == 1);
        List<Stone> stones = new ArrayList<>();
        if (phase == Phase.SETUP) {
            // 배치 중에는 내 알만 보낸다. 관전자는 아무것도 못 본다
            if (player) {
                for (int[] point : placed.get(seat)) stones.add(new Stone(seat, GRID_START + GRID_STEP * point[0], GRID_START + GRID_STEP * point[1], true));
            }
        } else {
            for (int index = 0; index < alive.length; index++) {
                stones.add(new Stone(sides[index], (int) Math.round(x[index]), (int) Math.round(y[index]), alive[index]));
            }
        }
        return new View(player ? seat : null, custom ? "CUSTOM" : "STANDARD", phase, maxStones,
            List.of(placed.get(0).size(), placed.get(1).size()), List.of(ready[0], ready[1]), turnSeat, stones,
            List.of(remaining(0), remaining(1)), shotCount, lastShot, List.copyOf(log), winnerSeat, phase == Phase.END);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
