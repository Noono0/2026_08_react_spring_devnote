package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.List;

/**
 * 알까기(2명). 바둑판 위에서 내 알을 손가락으로 튕겨 상대 알을 판 밖으로 떨어뜨린다.
 * 0번 자리 = 흑(아래쪽, 먼저), 1번 자리 = 백(위쪽).
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

    public enum Phase { PLAY, END }

    /** 알 하나. side 0 = 흑, 1 = 백. alive = 판 위에 남아 있는지 */
    public record Stone(int side, int x, int y, boolean alive) {}

    /** 마지막 튕기기: seq가 바뀌면 화면이 frames를 재생한다. frames[n] = [x0, y0, x1, y1, ...], 떨어진 알은 -1 */
    public record Shot(int seq, int shooterSeat, int stone, int angle, int power, List<List<Integer>> frames, int knockedOpponent, int knockedOwn) {}

    public record View(Integer mySeat, Phase phase, int turnSeat, List<Stone> stones, List<Integer> remaining, int shotCount,
                       Shot lastShot, List<String> log, Integer winnerSeat, boolean finished) {}

    private final List<String> nicknames;
    private final double[] x;
    private final double[] y;
    private final int[] sides;
    private final boolean[] alive;
    private final List<String> log = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.PLAY;
    private int turnSeat;
    private int shotCount;
    private Shot lastShot;
    private Integer winnerSeat;
    private boolean draw;

    public AlkkagiGame(List<String> nicknames, int stonesPerSide) {
        if (nicknames.size() != 2) throw new IllegalArgumentException("알까기는 2명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        int total = stonesPerSide * 2;
        x = new double[total];
        y = new double[total];
        sides = new int[total];
        alive = new boolean[total];
        // 흑은 아래쪽 줄, 백은 위쪽 줄에 같은 간격으로 놓는다
        for (int index = 0; index < total; index++) {
            int side = index < stonesPerSide ? 0 : 1;
            int order = index % stonesPerSide;
            sides[index] = side;
            x[index] = BOARD_SIZE * (order + 1.0) / (stonesPerSide + 1);
            y[index] = side == 0 ? 800 : 200;
            alive[index] = true;
        }
        say("알까기 시작! 흑(" + nicknames.get(0) + ") 알 " + stonesPerSide + "개 vs 백(" + nicknames.get(1) + ") 알 " + stonesPerSide + "개. 흑부터 튕기세요.");
    }

    /** 테스트용: 알 위치를 직접 놓는다. stones = [side, x, y] 목록 */
    AlkkagiGame(List<String> nicknames, List<int[]> stones) {
        this.nicknames = List.copyOf(nicknames);
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

    /** 알 개수 옵션("4"·"6"·"8") → 숫자 */
    public static int stoneCountFor(String option) {
        return option == null ? 6 : Integer.parseInt(option);
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
        for (int index = 0; index < alive.length; index++) {
            stones.add(new Stone(sides[index], (int) Math.round(x[index]), (int) Math.round(y[index]), alive[index]));
        }
        return new View(player ? seat : null, phase, turnSeat, stones, List.of(remaining(0), remaining(1)), shotCount, lastShot,
            List.copyOf(log), winnerSeat, phase == Phase.END);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
