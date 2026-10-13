package com.example.devnote.online.domain.game.billiards;

import java.util.ArrayList;
import java.util.List;

/**
 * 당구 물리(서버가 계산하고, 화면은 결과 궤적을 재생만 한다).
 *
 * [좌표] 미터·초. 테이블 왼쪽 아래 모서리가 (0, 0), x = 긴 쪽(length), y = 짧은 쪽(width), z = 위.
 * [공 상태] 위치 (x, y), 속도 (vx, vy), 회전 (wx, wy, wz).
 *   - wx·wy: 가로축 회전(밀어치기·끌어치기, 굴러가기)
 *   - wz: 세로축 회전(당점 좌우 = 잉글리시). 쿠션·공에 닿을 때 마찰로 방향을 바꾼다.
 *
 * [한 걸음(DT = 1/1800초)마다]
 *   1) 천과의 마찰: 바닥 접점이 미끄러지면(속도 ≠ 회전) 미끄럼 마찰(MU_SLIDE)로 속도·회전을 함께 바꾸고,
 *      접점이 멈추면(자연 회전) 굴림 저항(MU_ROLL)만 받는다. 세로축 회전은 천 마찰로 천천히 줄어든다.
 *      → 끌어치기 공이 처음엔 앞으로 미끄러지다 뒤로 돌아오는 것, 밀어치기 공이 맞힌 뒤 따라가는 것이 여기서 나온다.
 *   2) 위치 이동 → 포켓(8볼) → 쿠션 → 공끼리 충돌 순서로 검사한다.
 *   3) 쿠션: 들어오는 속도는 반발 계수(속도가 빠를수록 작음)만큼 튕기고, 잉글리시는 쿠션 마찰로 반사각을 바꾼다.
 *   4) 공끼리: 같은 질량의 비탄성 충돌(반발 0.94) + 접점 마찰(스로·회전 전달).
 *      수구의 가로축 회전은 그대로 남아, 부딪친 뒤 다시 천 마찰로 따라가거나(밀어치기) 끌려온다(끌어치기).
 *
 * [결정성] 같은 입력이면 항상 같은 결과다(난수 없음). 그래서 테스트에서 "이 샷은 쿠션 몇 번" 같은 검사를 할 수 있다.
 * [결과] 1/30초마다 모든 공의 위치(mm, 정수)를 frames에 담고, 충돌·쿠션·포켓은 events에 시간 순서로 담는다.
 */
public final class BilliardsPhysics {
    private BilliardsPhysics() {}

    static final double G = 9.81;
    static final double MU_SLIDE = 0.2;
    static final double MU_ROLL = 0.011;
    static final double MU_SPIN = 0.012;
    static final double MU_CUSHION = 0.2;
    static final double MU_BALL = 0.06;
    static final double BALL_RESTITUTION = 0.94;
    static final double DT = 1.0 / 1800;
    static final int STEPS_PER_FRAME = 60; // 1/30초
    static final double MAX_SECONDS = 40;
    static final double STOP_SPEED = 0.004;

    /** 테이블 규격. pocketed=true면 구멍이 6개 있는 포켓 테이블 */
    public record Table(double length, double width, double radius, boolean pockets) {
        public static final Table CAROM = new Table(2.844, 1.422, 0.03075, false);
        public static final Table POOL = new Table(2.54, 1.27, 0.028575, true);

        /** 포켓 중심(구석 4 + 가운데 2). 테이블 밖으로 조금 나가 있다 */
        public double[][] pocketCenters() {
            double out = 0.012;
            return new double[][] {
                {-out, -out}, {length / 2, -out * 1.6}, {length + out, -out},
                {-out, width + out}, {length / 2, width + out * 1.6}, {length + out, width + out},
            };
        }

        double pocketRadius(int index) {
            return index == 1 || index == 4 ? 0.056 : 0.062;
        }

        /** 이 위치의 레일은 포켓 입구라 쿠션이 없다 */
        boolean inLongRailMouth(double x) {
            return pockets && (x < 0.085 || x > length - 0.085 || Math.abs(x - length / 2) < 0.06);
        }

        boolean inShortRailMouth(double y) {
            return pockets && (y < 0.085 || y > width - 0.085);
        }
    }

    public static final class Ball {
        public final int id;
        public double x, y, vx, vy, wx, wy, wz;
        public boolean pocketed;

        public Ball(int id, double x, double y) {
            this.id = id;
            this.x = x;
            this.y = y;
        }

        boolean moving(double radius) {
            if (pocketed) return false;
            double slip = Math.hypot(vx - radius * wy, vy + radius * wx);
            return Math.hypot(vx, vy) > STOP_SPEED || slip > STOP_SPEED;
        }

        void stop() {
            vx = vy = wx = wy = wz = 0;
        }
    }

    /**
     * 큐로 치는 값.
     * @param angle 조준 방향(라디안, x축에서 반시계)
     * @param speed 처음 공 속도(m/s)
     * @param side 당점 좌우(-0.5 ~ 0.5, 반지름 비율, + = 오른쪽)
     * @param vertical 당점 위아래(-0.5 ~ 0.5, + = 위 = 밀어치기, - = 끌어치기)
     */
    public record Shot(double angle, double speed, double side, double vertical) {}

    /** type: BALL(a와 b가 부딪침), CUSHION(a가 쿠션에 닿음, b = 레일 0아래 1오른 2위 3왼), POCKET(a가 b번 포켓에 들어감) */
    public record Event(int timeMs, String type, int a, int b) {}

    public record Result(List<int[]> frames, List<Event> events, int durationMs) {}

    /** 수구(cue)를 shot으로 치고 모든 공이 멈출 때까지 계산한다. balls는 끝난 상태로 바뀐다 */
    public static Result simulate(Table table, List<Ball> balls, int cueId, Shot shot) {
        Ball cue = balls.stream().filter(ball -> ball.id == cueId).findFirst().orElseThrow();
        strike(table, cue, shot);
        List<int[]> frames = new ArrayList<>();
        List<Event> events = new ArrayList<>();
        frames.add(snapshot(balls));
        int maxSteps = (int) (MAX_SECONDS / DT);
        int step = 0;
        boolean anyMoving = true;
        while (anyMoving && step < maxSteps) {
            step++;
            int timeMs = (int) Math.round(step * DT * 1000);
            for (Ball ball : balls) if (!ball.pocketed) move(table, ball);
            if (table.pockets()) for (Ball ball : balls) capture(table, ball, timeMs, events);
            for (Ball ball : balls) if (!ball.pocketed) cushion(table, ball, timeMs, events);
            for (int i = 0; i < balls.size(); i++) {
                for (int j = i + 1; j < balls.size(); j++) collide(table, balls.get(i), balls.get(j), timeMs, events);
            }
            anyMoving = false;
            for (Ball ball : balls) {
                if (ball.moving(table.radius())) anyMoving = true;
            }
            if (step % STEPS_PER_FRAME == 0 || !anyMoving) frames.add(snapshot(balls));
        }
        for (Ball ball : balls) ball.stop();
        return new Result(frames, events, (int) Math.round(step * DT * 1000));
    }

    /** 큐 끝이 당점을 칠 때: 속도는 조준 방향, 회전은 당점이 중심에서 벗어난 만큼(토크 = 힘 × 거리) */
    static void strike(Table table, Ball cue, Shot shot) {
        double radius = table.radius();
        // 스쿼트: 좌우 당점을 주면 공이 반대쪽으로 아주 조금 밀려 나간다
        double angle = shot.angle() + shot.side() * 0.03;
        double dx = Math.cos(angle);
        double dy = Math.sin(angle);
        cue.vx = shot.speed() * dx;
        cue.vy = shot.speed() * dy;
        // 위아래 당점: 굴러가는 방향(밀어치기 +)의 가로축 회전. vertical 0.4 ≒ 바로 자연스럽게 구르는 회전
        double roll = 2.5 * shot.speed() * shot.vertical() / radius;
        cue.wx = -dy * roll;
        cue.wy = dx * roll;
        cue.wz = 2.5 * shot.speed() * shot.side() / radius;
    }

    /** 천 마찰 + 이동 */
    static void move(Table table, Ball ball) {
        double radius = table.radius();
        double ux = ball.vx - radius * ball.wy;
        double uy = ball.vy + radius * ball.wx;
        double slip = Math.hypot(ux, uy);
        double slide = MU_SLIDE * G * DT;
        if (slip > 1e-6) {
            if (slip <= 3.5 * slide) {
                // 이번 걸음에 미끄러짐이 끝난다: 속도는 접점 속도의 2/7만큼 바뀌고 자연 회전이 된다
                ball.vx -= ux / 3.5;
                ball.vy -= uy / 3.5;
                ball.wx = -ball.vy / radius;
                ball.wy = ball.vx / radius;
            } else {
                double nx = ux / slip;
                double ny = uy / slip;
                ball.vx -= slide * nx;
                ball.vy -= slide * ny;
                ball.wx -= 2.5 * slide * ny / radius;
                ball.wy += 2.5 * slide * nx / radius;
            }
        } else {
            double speed = Math.hypot(ball.vx, ball.vy);
            double roll = MU_ROLL * G * DT;
            if (speed <= roll) {
                ball.vx = 0;
                ball.vy = 0;
            } else {
                ball.vx -= roll * ball.vx / speed;
                ball.vy -= roll * ball.vy / speed;
            }
            ball.wx = -ball.vy / radius;
            ball.wy = ball.vx / radius;
        }
        double spinDrop = 2.5 * MU_SPIN * G / radius * DT;
        ball.wz = Math.abs(ball.wz) <= spinDrop ? 0 : ball.wz - Math.signum(ball.wz) * spinDrop;
        ball.x += ball.vx * DT;
        ball.y += ball.vy * DT;
    }

    static void capture(Table table, Ball ball, int timeMs, List<Event> events) {
        if (ball.pocketed) return;
        double[][] pockets = table.pocketCenters();
        for (int index = 0; index < pockets.length; index++) {
            if (Math.hypot(ball.x - pockets[index][0], ball.y - pockets[index][1]) < table.pocketRadius(index)) {
                pocket(ball, index, timeMs, events);
                return;
            }
        }
        // 포켓 입구로 레일 선을 넘어가면(턱에 맞고 빠지는 경우 포함) 가장 가까운 포켓에 들어간 것으로 본다
        if (ball.x < 0 || ball.y < 0 || ball.x > table.length() || ball.y > table.width()) {
            int nearest = 0;
            for (int index = 1; index < pockets.length; index++) {
                if (Math.hypot(ball.x - pockets[index][0], ball.y - pockets[index][1])
                    < Math.hypot(ball.x - pockets[nearest][0], ball.y - pockets[nearest][1])) nearest = index;
            }
            pocket(ball, nearest, timeMs, events);
        }
    }

    private static void pocket(Ball ball, int pocketIndex, int timeMs, List<Event> events) {
        ball.pocketed = true;
        ball.stop();
        events.add(new Event(timeMs, "POCKET", ball.id, pocketIndex));
    }

    /** 레일 4개. 레일 안쪽 방향(n)으로 튕기고, 접점 마찰로 잉글리시가 반사각을 바꾼다 */
    static void cushion(Table table, Ball ball, int timeMs, List<Event> events) {
        double radius = table.radius();
        if (ball.y < radius && ball.vy < 0 && !table.inLongRailMouth(ball.x)) {
            ball.y = radius;
            bounce(table, ball, 0, 1, 0, timeMs, events);
        } else if (ball.y > table.width() - radius && ball.vy > 0 && !table.inLongRailMouth(ball.x)) {
            ball.y = table.width() - radius;
            bounce(table, ball, 0, -1, 2, timeMs, events);
        }
        if (ball.x < radius && ball.vx < 0 && !table.inShortRailMouth(ball.y)) {
            ball.x = radius;
            bounce(table, ball, 1, 0, 3, timeMs, events);
        } else if (ball.x > table.length() - radius && ball.vx > 0 && !table.inShortRailMouth(ball.y)) {
            ball.x = table.length() - radius;
            bounce(table, ball, -1, 0, 1, timeMs, events);
        }
    }

    private static void bounce(Table table, Ball ball, double nx, double ny, int rail, int timeMs, List<Event> events) {
        double radius = table.radius();
        double vn = ball.vx * nx + ball.vy * ny; // 음수(레일 쪽으로)
        double tx = -ny;
        double ty = nx;
        double vt = ball.vx * tx + ball.vy * ty;
        // 빠르게 박을수록 쿠션 고무가 더 눌려 덜 튕긴다
        double restitution = Math.max(0.6, 0.9 - 0.045 * Math.abs(vn));
        double normalImpulse = (1 + restitution) * Math.abs(vn);
        // 쿠션 접점의 미끄러짐 = 공 옆면 속도 - 세로축 회전
        double slip = vt - radius * ball.wz;
        double tangentImpulse = -Math.signum(slip) * Math.min(MU_CUSHION * normalImpulse, Math.abs(slip) / 3.5);
        ball.vx += normalImpulse * nx + tangentImpulse * tx;
        ball.vy += normalImpulse * ny + tangentImpulse * ty;
        ball.wz -= 2.5 * tangentImpulse / radius;
        // 레일 쪽으로 구르던 회전은 쿠션(공 중심보다 높은 곳)에 눌려 많이 줄어든다
        double rollIntoRail = ball.wx * tx + ball.wy * ty;
        ball.wx -= 0.7 * rollIntoRail * tx;
        ball.wy -= 0.7 * rollIntoRail * ty;
        events.add(new Event(timeMs, "CUSHION", ball.id, rail));
    }

    /** 공끼리 충돌: 겹쳤고 서로 다가오는 중일 때만 */
    static void collide(Table table, Ball first, Ball second, int timeMs, List<Event> events) {
        if (first.pocketed || second.pocketed) return;
        double radius = table.radius();
        double dx = second.x - first.x;
        double dy = second.y - first.y;
        double distance = Math.hypot(dx, dy);
        if (distance >= 2 * radius || distance == 0) return;
        double nx = dx / distance;
        double ny = dy / distance;
        double approach = (first.vx - second.vx) * nx + (first.vy - second.vy) * ny;
        // 겹친 만큼 떼어 놓는다(다음 걸음에 또 부딪친 것으로 보지 않도록)
        double push = (2 * radius - distance) / 2;
        first.x -= nx * push;
        first.y -= ny * push;
        second.x += nx * push;
        second.y += ny * push;
        if (approach <= 0) return;
        double impulse = (1 + BALL_RESTITUTION) / 2 * approach;
        first.vx -= impulse * nx;
        first.vy -= impulse * ny;
        second.vx += impulse * nx;
        second.vy += impulse * ny;
        // 접점 마찰: 옆으로 스치는 속도와 세로축 회전 때문에 맞은 공이 조금 끌려간다(스로)
        double tx = -ny;
        double ty = nx;
        double slip = (first.vx - second.vx) * tx + (first.vy - second.vy) * ty + radius * (first.wz + second.wz);
        double friction = -Math.signum(slip) * Math.min(MU_BALL * impulse, Math.abs(slip) / 7);
        first.vx += friction * tx;
        first.vy += friction * ty;
        second.vx -= friction * tx;
        second.vy -= friction * ty;
        first.wz += 2.5 * friction / radius;
        second.wz += 2.5 * friction / radius;
        events.add(new Event(timeMs, "BALL", first.id, second.id));
    }

    /** 모든 공의 위치(mm). 들어간 공은 -1 */
    static int[] snapshot(List<Ball> balls) {
        int[] frame = new int[balls.size() * 2];
        for (int index = 0; index < balls.size(); index++) {
            Ball ball = balls.get(index);
            frame[index * 2] = ball.pocketed ? -1 : (int) Math.round(ball.x * 1000);
            frame[index * 2 + 1] = ball.pocketed ? -1 : (int) Math.round(ball.y * 1000);
        }
        return frame;
    }
}
