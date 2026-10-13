package com.example.devnote.online.domain.game.billiards;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.online.domain.game.GameAction;
import com.example.devnote.online.domain.game.OnlineGame;
import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Ball;
import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Event;
import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Table;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * 당구(1~2명). 방 옵션으로 종목을 고른다. 1명이면 혼자 연습(목표 점수까지·테이블 비우기).
 *
 * [3쿠션] 0번 자리 = 흰 공, 1번 자리 = 노란 공, 빨간 공 1개. 내 공으로 두 공을 모두 맞히되,
 *         두 번째 공을 맞히기 전까지 내 공이 쿠션에 3번 이상 닿으면 1점, 계속 친다. 먼저 10점이면 승리.
 * [4구]   흰·노란 공 + 빨간 공 2개. 내 공으로 빨간 공 둘을 맞히면 1점, 계속 친다.
 *         상대 공을 맞히면 1점 잃고(0점 아래로는 안 내려감) 차례가 넘어간다. 먼저 10점이면 승리.
 * [8볼]   흰 공(수구) + 1~15번. 처음 넣은 공으로 솔리드(1~7)·스트라이프(9~15)가 정해진다.
 *         내 무리 공을 넣으면 계속 치고, 파울(수구가 빠짐·아무것도 못 맞힘·처음 맞힌 공이 남의 무리·
 *         맞힌 뒤 아무 공도 쿠션에 닿거나 들어가지 않음)이면 상대가 수구를 원하는 곳에 놓고 친다(PLACE).
 *         내 무리를 다 넣은 뒤 8번을 파울 없이 넣으면 승리, 그 전에 8번을 넣으면 패배(브레이크 때는 다시 놓음).
 *
 * [행동] SHOT numbers = [조준 각도(1/1000도), 힘(1~100), 당점 좌우(-50~50), 당점 위아래(-50~50)]
 *        PLACE numbers = [x(mm), y(mm)] — 8볼 파울 뒤 수구 놓기
 * [화면] 샷이 끝난 상태와 함께 궤적(lastShot.frames)을 보내 주면, 화면은 그 궤적을 3D로 재생한다.
 */
public class BilliardsGame implements OnlineGame {
    public enum Variant {
        THREE_CUSHION("3쿠션"), FOUR_BALL("4구"), EIGHT_BALL("8볼 포켓");

        private final String label;

        Variant(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public static final int TARGET_SCORE = 10;
    static final int MAX_INNINGS = 30;
    /** 4구: 흰 공 0, 노란 공 1, 빨간 공 2·3. 3쿠션: 흰 0, 노랑 1, 빨강 2. 8볼: 수구 0, 1~15번 */
    public record BallView(int id, int x, int y, boolean pocketed) {}

    public record ShotView(int seq, int shooterSeat, int cueBall, List<int[]> frames, List<Event> events, int durationMs, String summary) {}

    public record View(String variant, String variantLabel, int tableLength, int tableWidth, double ballRadius, boolean pockets,
                       List<BallView> balls, Integer mySeat, Integer turnSeat, List<Integer> cueBalls, List<Integer> scores,
                       int target, List<Integer> innings, List<String> groups, boolean ballInHand, ShotView lastShot,
                       List<Integer> winners, String result, boolean finished) {}

    private final Variant variant;
    private final Table table;
    private final List<String> nicknames;
    private final List<Ball> balls = new ArrayList<>();
    private final int[] scores;
    private final int[] innings;
    private final String[] groups;
    private final List<String> announcements = new ArrayList<>();
    private int turnSeat;
    private int shotSeq;
    private boolean ballInHand;
    private ShotView lastShot;
    private boolean finished;
    private final List<Integer> winners = new ArrayList<>();
    private String result;

    public BilliardsGame(List<String> nicknames, Variant variant, Random random) {
        if (nicknames.isEmpty() || nicknames.size() > 2) throw new IllegalArgumentException("당구는 1~2명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        this.variant = variant;
        this.table = variant == Variant.EIGHT_BALL ? Table.POOL : Table.CAROM;
        scores = new int[nicknames.size()];
        innings = new int[nicknames.size()];
        groups = new String[nicknames.size()];
        setUpBalls(random);
        innings[0] = 1;
        announcements.add("당구(" + variant.label() + ") 시작! " + nicknames.get(0) + " 님부터 칩니다."
            + (variant == Variant.EIGHT_BALL ? " 브레이크샷!" : " 목표 " + TARGET_SCORE + "점."));
    }

    private void setUpBalls(Random random) {
        double length = table.length();
        double width = table.width();
        double headX = length / 4;
        double footX = length * 3 / 4;
        double centerY = width / 2;
        switch (variant) {
            case THREE_CUSHION -> {
                balls.add(new Ball(0, headX, centerY + 0.1524));
                balls.add(new Ball(1, headX, centerY));
                balls.add(new Ball(2, footX, centerY));
            }
            case FOUR_BALL -> {
                balls.add(new Ball(0, headX, centerY + 0.15));
                balls.add(new Ball(1, headX, centerY - 0.15));
                balls.add(new Ball(2, footX, centerY));
                balls.add(new Ball(3, length / 2, centerY));
            }
            case EIGHT_BALL -> {
                balls.add(new Ball(0, headX, centerY));
                // 삼각 랙: 맨 앞이 풋 스폿, 3번째 줄 가운데가 8번, 마지막 줄 두 구석은 솔리드 하나·스트라이프 하나
                List<Integer> solids = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6, 7));
                List<Integer> stripes = new ArrayList<>(List.of(9, 10, 11, 12, 13, 14, 15));
                Collections.shuffle(solids, random);
                Collections.shuffle(stripes, random);
                int cornerSolid = solids.remove(0);
                int cornerStripe = stripes.remove(0);
                List<Integer> rest = new ArrayList<>(solids);
                rest.addAll(stripes);
                Collections.shuffle(rest, random);
                double radius = table.radius();
                double gap = 0.0002;
                int position = 0;
                List<Ball> racked = new ArrayList<>();
                for (int row = 0; row < 5; row++) {
                    for (int index = 0; index <= row; index++) {
                        int number;
                        if (position == 4) number = 8;
                        else if (position == 10) number = random.nextBoolean() ? cornerSolid : cornerStripe;
                        else if (position == 14) number = racked.stream().anyMatch(ball -> ball.id == cornerSolid) ? cornerStripe : cornerSolid;
                        else number = rest.remove(0);
                        double x = footX + row * (2 * radius + gap) * Math.sqrt(3) / 2;
                        double y = centerY + (index - row / 2.0) * (2 * radius + gap);
                        racked.add(new Ball(number, x, y));
                        position++;
                    }
                }
                racked.sort((first, second) -> Integer.compare(first.id, second.id));
                balls.addAll(racked);
            }
        }
    }

    private Ball ball(int id) {
        return balls.stream().filter(ball -> ball.id == id).findFirst().orElseThrow();
    }

    /** 이 자리가 치는 공 */
    int cueBallOf(int seat) {
        return variant == Variant.EIGHT_BALL ? 0 : seat;
    }

    // ── 행동 ────────────────────────────────────────────────────

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= nicknames.size()) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        List<Integer> numbers = action.numbers();
        if (numbers == null || numbers.stream().anyMatch(number -> number == null)) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        switch (action.actionName()) {
            case "SHOT" -> shoot(seat, numbers);
            case "PLACE" -> place(numbers);
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void place(List<Integer> numbers) {
        if (!ballInHand) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "파울 뒤에만 수구를 옮길 수 있습니다.");
        if (numbers.size() != 2) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        double x = numbers.get(0) / 1000.0;
        double y = numbers.get(1) / 1000.0;
        if (!isFree(x, y, 0)) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "테이블 안, 다른 공과 겹치지 않는 곳에 놓아 주세요.");
        Ball cue = ball(0);
        cue.x = x;
        cue.y = y;
        cue.pocketed = false;
    }

    /** (x, y)에 공을 놓을 수 있는가(테이블 안, 다른 공과 겹치지 않음) */
    private boolean isFree(double x, double y, int exceptId) {
        double radius = table.radius();
        if (x < radius || y < radius || x > table.length() - radius || y > table.width() - radius) return false;
        for (Ball other : balls) {
            if (other.id != exceptId && !other.pocketed && Math.hypot(other.x - x, other.y - y) < 2 * radius + 0.001) return false;
        }
        return true;
    }

    private void shoot(int seat, List<Integer> numbers) {
        if (numbers.size() != 4) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        int angle = numbers.get(0);
        int power = numbers.get(1);
        int side = numbers.get(2);
        int vertical = numbers.get(3);
        if (angle < 0 || angle >= 360_000 || power < 1 || power > 100 || side * side + vertical * vertical > 2500) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "샷 값이 올바르지 않습니다(힘 1~100, 당점은 원 안).");
        }
        int cueId = cueBallOf(seat);
        BilliardsPhysics.Shot shot = new BilliardsPhysics.Shot(Math.toRadians(angle / 1000.0), 0.4 + power / 100.0 * 6.6,
            side / 100.0, vertical / 100.0);
        Set<Integer> pocketedBefore = pocketedIds();
        BilliardsPhysics.Result simulated = BilliardsPhysics.simulate(table, balls, cueId, shot);
        shotSeq++;
        ballInHand = false;
        String summary = variant == Variant.EIGHT_BALL ? judgeEightBall(seat, simulated.events(), pocketedBefore) : judgeCarom(seat, simulated.events());
        lastShot = new ShotView(shotSeq, seat, cueId, simulated.frames(), simulated.events(), simulated.durationMs(), summary);
    }

    private Set<Integer> pocketedIds() {
        Set<Integer> ids = new HashSet<>();
        for (Ball ball : balls) if (ball.pocketed) ids.add(ball.id);
        return ids;
    }

    // ── 캐롬(3쿠션·4구) 판정 ────────────────────────────────────

    String judgeCarom(int seat, List<Event> events) {
        int cue = cueBallOf(seat);
        int cushions = 0;
        Set<Integer> hit = new LinkedHashSet<>();
        Integer cushionsAtSecondHit = null;
        boolean hitOpponentBall = false;
        for (Event event : events) {
            if ("CUSHION".equals(event.type()) && event.a() == cue) cushions++;
            if (!"BALL".equals(event.type()) || (event.a() != cue && event.b() != cue)) continue;
            int other = event.a() == cue ? event.b() : event.a();
            if (variant == Variant.FOUR_BALL && other <= 1) hitOpponentBall = true;
            if (hit.add(other) && hit.size() == 2 && cushionsAtSecondHit == null) cushionsAtSecondHit = cushions;
        }
        boolean scored;
        String summary;
        if (variant == Variant.THREE_CUSHION) {
            scored = cushionsAtSecondHit != null && cushionsAtSecondHit >= 3;
            summary = hit.size() < 2 ? "두 공을 다 맞히지 못함 (쿠션 " + cushions + "번)"
                : scored ? "3쿠션 성공! (두 번째 공 전에 쿠션 " + cushionsAtSecondHit + "번)"
                : "두 공은 맞혔지만 쿠션이 " + cushionsAtSecondHit + "번뿐";
        } else {
            boolean bothReds = hit.contains(2) && hit.contains(3);
            scored = bothReds && !hitOpponentBall;
            summary = hitOpponentBall ? "상대 공을 맞혀 1점 잃음" : scored ? "빨간 공 둘을 맞혀 득점!" : "빨간 공 둘을 다 맞히지 못함";
            if (hitOpponentBall) scores[seat] = Math.max(0, scores[seat] - 1);
        }
        if (scored) {
            scores[seat]++;
            announcements.add(nicknames.get(seat) + " 득점! " + scores[seat] + "점 — " + summary);
            if (scores[seat] >= TARGET_SCORE) {
                end(List.of(seat), nicknames.get(seat) + " 승리 (" + scoreLine() + ")");
            }
            return summary;
        }
        nextTurn();
        return summary;
    }

    private String scoreLine() {
        List<String> parts = new ArrayList<>();
        for (int seat = 0; seat < nicknames.size(); seat++) parts.add(nicknames.get(seat) + " " + scores[seat]);
        return String.join(" : ", parts);
    }

    /** 차례 넘기기. 캐롬은 이닝 수가 다 차면 점수로 끝낸다(8볼은 이닝 제한 없음) */
    private void nextTurn() {
        turnSeat = (turnSeat + 1) % nicknames.size();
        if (variant != Variant.EIGHT_BALL && innings[turnSeat] >= MAX_INNINGS) {
            finishByScore(MAX_INNINGS + "이닝 종료");
            return;
        }
        innings[turnSeat]++;
    }

    private void finishByScore(String reason) {
        int best = 0;
        for (int score : scores) best = Math.max(best, score);
        List<Integer> top = new ArrayList<>();
        for (int seat = 0; seat < scores.length; seat++) if (scores[seat] == best) top.add(seat);
        String who = top.size() == 1 ? nicknames.get(top.get(0)) + " 승리" : "무승부";
        end(top.size() == 1 ? top : List.of(), reason + " — " + who + " (" + scoreLine() + ")");
    }

    // ── 8볼 판정 ────────────────────────────────────────────────

    private static boolean isSolid(int id) {
        return id >= 1 && id <= 7;
    }

    private static boolean isStripe(int id) {
        return id >= 9 && id <= 15;
    }

    private boolean belongsTo(String group, int id) {
        return "SOLID".equals(group) ? isSolid(id) : "STRIPE".equals(group) ? isStripe(id) : id != 0 && id != 8;
    }

    /** 이 무리(그룹 없으면 8번 빼고 전부)가 테이블에서 다 빠졌는가 */
    private boolean cleared(String group, Set<Integer> pocketed) {
        for (Ball ball : balls) if (belongsTo(group, ball.id) && !pocketed.contains(ball.id)) return false;
        return true;
    }

    String judgeEightBall(int seat, List<Event> events, Set<Integer> pocketedBefore) {
        boolean breakShot = shotSeq == 1;
        boolean solo = nicknames.size() == 1;
        String myGroup = groups[seat];
        boolean clearedBefore = cleared(myGroup, pocketedBefore) && (myGroup != null || solo);

        Integer firstHit = null;
        int firstHitTime = Integer.MAX_VALUE;
        boolean railAfterHit = false;
        List<Integer> pocketedNow = new ArrayList<>();
        for (Event event : events) {
            if ("BALL".equals(event.type()) && firstHit == null && (event.a() == 0 || event.b() == 0)) {
                firstHit = event.a() == 0 ? event.b() : event.a();
                firstHitTime = event.timeMs();
            }
            if ("CUSHION".equals(event.type()) && event.timeMs() >= firstHitTime) railAfterHit = true;
            if ("POCKET".equals(event.type())) pocketedNow.add(event.a());
        }
        boolean scratch = pocketedNow.contains(0);
        boolean eightIn = pocketedNow.contains(8);
        List<Integer> objectsIn = pocketedNow.stream().filter(id -> id != 0 && id != 8).toList();

        String foul = null;
        if (scratch) foul = "수구가 빠짐";
        else if (firstHit == null) foul = "아무 공도 맞히지 못함";
        else if (!breakShot && !solo && myGroup != null && !(clearedBefore ? firstHit == 8 : belongsTo(myGroup, firstHit))) foul = "처음 맞힌 공이 내 무리가 아님";
        else if (!breakShot && !solo && myGroup == null && firstHit == 8) foul = "8번을 먼저 맞힘";
        else if (!breakShot && pocketedNow.isEmpty() && !railAfterHit) foul = "맞힌 뒤 아무 공도 쿠션에 닿지 않음";

        // 8번이 들어갔을 때
        if (eightIn) {
            if (breakShot) {
                respotEight();
                announcements.add("브레이크에서 8번이 들어가 다시 놓습니다.");
            } else if (clearedBefore && foul == null) {
                end(List.of(seat), nicknames.get(seat) + " 승리 — 8번까지 넣었습니다");
                return "8번 성공!";
            } else {
                String reason = foul != null ? "8번을 넣으며 파울(" + foul + ")" : "내 무리를 다 넣기 전에 8번을 넣음";
                if (solo) end(List.of(), "연습 끝 — " + reason);
                else end(List.of(1 - seat), nicknames.get(1 - seat) + " 승리 — " + nicknames.get(seat) + " 님이 " + reason);
                return reason;
            }
        }
        if (scratch) placeCueAtHead();

        // 무리 정하기: 테이블이 열려 있을 때 파울 없이 처음 넣은 공의 무리
        if (!solo && myGroup == null && foul == null && !objectsIn.isEmpty() && !breakShot) {
            groups[seat] = isSolid(objectsIn.get(0)) ? "SOLID" : "STRIPE";
            groups[1 - seat] = "SOLID".equals(groups[seat]) ? "STRIPE" : "SOLID";
            myGroup = groups[seat];
            announcements.add(nicknames.get(seat) + " 님은 " + ("SOLID".equals(myGroup) ? "솔리드(1~7)" : "스트라이프(9~15)") + "입니다.");
        }
        if (solo && cleared(null, pocketedIds())) {
            announcements.add("8번 빼고 모두 넣었습니다. 이제 8번!");
        }

        String finalGroup = myGroup;
        boolean pocketedOwn = breakShot ? !objectsIn.isEmpty() : objectsIn.stream().anyMatch(id -> belongsTo(finalGroup, id));
        String summary = foul != null ? "파울: " + foul
            : objectsIn.isEmpty() ? "넣은 공 없음" : objectsIn.size() + "개 넣음 (" + objectsIn.stream().map(String::valueOf).reduce((a, b) -> a + ", " + b).orElse("") + "번)";
        if (foul != null) {
            announcements.add(nicknames.get(seat) + " 파울 — " + foul + ". " + (solo ? "" : nicknames.get(1 - seat) + " 님이 ") + "수구를 원하는 곳에 놓고 칩니다.");
            ballInHand = true;
            nextTurn();
        } else if (!pocketedOwn) {
            nextTurn();
        }
        return summary;
    }

    private void respotEight() {
        Ball eight = ball(8);
        eight.pocketed = false;
        double x = table.length() * 3 / 4;
        while (!isFree(x, table.width() / 2, 8)) x += 0.002;
        eight.x = x;
        eight.y = table.width() / 2;
    }

    private void placeCueAtHead() {
        Ball cue = ball(0);
        cue.pocketed = false;
        double x = table.length() / 4;
        double y = table.width() / 2;
        while (!isFree(x, y, 0)) x -= 0.002;
        cue.x = x;
        cue.y = y;
    }

    private void end(List<Integer> winnerSeats, String text) {
        finished = true;
        winners.clear();
        winners.addAll(winnerSeats);
        result = text;
    }

    // ── 공통 ────────────────────────────────────────────────────

    @Override
    public void leave(int seat) {
        if (finished) return;
        if (nicknames.size() == 1) end(List.of(), "연습을 그만뒀습니다");
        else end(List.of(1 - seat), nicknames.get(seat) + " 기권·퇴장 — " + nicknames.get(1 - seat) + " 승리");
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
        return "당구(" + variant.label() + ") " + (result == null ? "끝" : result);
    }

    @Override
    public Object viewFor(Integer seat) {
        List<BallView> ballViews = balls.stream()
            .map(ball -> new BallView(ball.id, (int) Math.round(ball.x * 1000), (int) Math.round(ball.y * 1000), ball.pocketed)).toList();
        List<Integer> cueBalls = new ArrayList<>();
        List<Integer> scoreList = new ArrayList<>();
        List<Integer> inningList = new ArrayList<>();
        List<String> groupList = new ArrayList<>();
        for (int index = 0; index < nicknames.size(); index++) {
            cueBalls.add(cueBallOf(index));
            scoreList.add(scores[index]);
            inningList.add(innings[index]);
            groupList.add(groups[index]);
        }
        Integer mySeat = seat != null && seat >= 0 && seat < nicknames.size() ? seat : null;
        return new View(variant.name(), variant.label(), (int) Math.round(table.length() * 1000), (int) Math.round(table.width() * 1000),
            table.radius() * 1000, table.pockets(), ballViews, mySeat, finished ? null : turnSeat, cueBalls, scoreList,
            TARGET_SCORE, inningList, groupList, ballInHand && !finished, lastShot, List.copyOf(winners), result, finished);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }

    /** 테스트용: 공 위치를 직접 정한다 */
    void placeBall(int id, double x, double y) {
        Ball target = ball(id);
        target.x = x;
        target.y = y;
        target.pocketed = false;
    }

    /** 테스트용: 공을 이미 들어간 것으로 */
    void removeBall(int id) {
        ball(id).pocketed = true;
    }

    Table table() {
        return table;
    }

    /** 테스트용: 지금까지 친 샷 수(판정 직전 값. 1이면 브레이크샷으로 본다) */
    void setShotCount(int count) {
        shotSeq = count;
    }
}
