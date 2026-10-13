package com.example.devnote.online.domain.game.billiards;

import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Ball;
import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Result;
import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Shot;
import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Table;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BilliardsPhysicsTest {
    private static final Table CAROM = Table.CAROM;

    private static Result shootAlone(double x, double y, Shot shot) {
        Ball cue = new Ball(0, x, y);
        return BilliardsPhysics.simulate(CAROM, List.of(cue), 0, shot);
    }

    @Test
    void 공은_결국_멈추고_첫_프레임은_친_자리다() {
        Result result = shootAlone(0.7, 0.711, new Shot(0, 2.0, 0, 0));
        assertThat(result.frames().get(0)).containsExactly(700, 711);
        assertThat(result.durationMs()).isBetween(1000, 40_000);
        assertThat(result.events()).anyMatch(event -> event.type().equals("CUSHION") && event.b() == 1); // 오른쪽 레일
        int[] last = result.frames().get(result.frames().size() - 1);
        assertThat(last[0]).isBetween(31, 2813);
    }

    @Test
    void 같은_샷은_항상_같은_결과다() {
        Result first = shootAlone(0.5, 0.4, new Shot(0.7, 4.0, 0.3, -0.2));
        Result second = shootAlone(0.5, 0.4, new Shot(0.7, 4.0, 0.3, -0.2));
        assertThat(second.events()).isEqualTo(first.events());
        assertThat(second.frames().get(second.frames().size() - 1)).containsExactly(first.frames().get(first.frames().size() - 1));
    }

    @Test
    void 처음엔_미끄러지다가_자연스럽게_구른다() {
        Ball cue = new Ball(0, 0.5, 0.711);
        BilliardsPhysics.strike(CAROM, cue, new Shot(0, 2.0, 0, 0));
        int steps = 0;
        while (Math.hypot(cue.vx - CAROM.radius() * cue.wy, cue.vy + CAROM.radius() * cue.wx) > 1e-6 && steps < 5000) {
            BilliardsPhysics.move(CAROM, cue);
            steps++;
        }
        // 미끄러지는 시간 = 처음 속도 / (3.5 × μ × g) ≒ 0.29초, 그때 속도는 처음 속도의 5/7
        assertThat(steps * BilliardsPhysics.DT).isCloseTo(2.0 / (3.5 * BilliardsPhysics.MU_SLIDE * BilliardsPhysics.G), org.assertj.core.data.Offset.offset(0.01));
        assertThat(cue.vx).isCloseTo(2.0 * 5 / 7, org.assertj.core.data.Offset.offset(0.01));
    }

    /** 수구가 1번 공(x 1.3m)을 정면으로 맞히고 0.6초 뒤 수구의 x(mm) */
    private static int cueAfterStraightHit(double vertical) {
        Ball cue = new Ball(0, 1.0, 0.711);
        Ball object = new Ball(1, 1.3, 0.711);
        Result result = BilliardsPhysics.simulate(CAROM, List.of(cue, object), 0, new Shot(0, 2.0, 0, vertical));
        int hitMs = result.events().get(0).timeMs();
        return result.frames().get((int) Math.round((hitMs + 600) / (1000.0 / 30)))[0];
    }

    @Test
    void 밀어치기는_맞힌_뒤_따라가고_끌어치기는_되돌아온다() {
        int contactX = 1300 - 62; // 맞는 순간 수구 중심
        int follow = cueAfterStraightHit(0.45);
        int center = cueAfterStraightHit(0);
        int draw = cueAfterStraightHit(-0.45);
        assertThat(follow).isGreaterThan(contactX + 100);
        assertThat(draw).isLessThan(contactX - 100);
        // 가운데 당점: 맞기 전에 이미 조금 구르기 시작해서 밀어치기보다 덜 따라간다
        assertThat(center).isBetween(contactX, follow - 50);
    }

    /** 오른쪽 레일로 정면으로 친 뒤, 쿠션에 닿고 0.3초 뒤의 y(mm) */
    private static int yAfterBounce(double side) {
        Result result = shootAlone(2.5, 0.711, new Shot(0, 1.5, side, 0));
        int bounceMs = result.events().stream().filter(event -> event.type().equals("CUSHION")).findFirst().orElseThrow().timeMs();
        int frame = (int) Math.round((bounceMs + 300) / (1000.0 / 30));
        return result.frames().get(frame)[1];
    }

    @Test
    void 오른쪽_당점은_쿠션에서_오른쪽으로_튄다() {
        // +x 방향(오른쪽 레일)으로 정면으로 칠 때, 치는 사람 기준 오른쪽 = -y
        assertThat(yAfterBounce(0.4)).isLessThan(690);
        assertThat(yAfterBounce(-0.4)).isGreaterThan(732);
        assertThat(yAfterBounce(0)).isEqualTo(711);
    }

    @Test
    void 정면으로_맞히면_수구는_거의_서고_맞은_공이_나간다() {
        Ball cue = new Ball(0, 1.0, 0.711);
        Ball object = new Ball(1, 1.065, 0.711);
        Result result = BilliardsPhysics.simulate(CAROM, List.of(cue, object), 0, new Shot(0, 1.0, 0, 0));
        assertThat(result.events().get(0).type()).isEqualTo("BALL");
        assertThat(cue.x).isLessThan(1.1);
        assertThat(object.x).isGreaterThan(1.3);
    }

    @Test
    void 포켓_테이블에서_구석으로_치면_공이_들어간다() {
        Table pool = Table.POOL;
        Ball cue = new Ball(0, 0.4, 0.4);
        Result result = BilliardsPhysics.simulate(pool, List.of(cue), 0, new Shot(Math.atan2(-0.4, -0.4), 2.0, 0, 0));
        assertThat(result.events()).anyMatch(event -> event.type().equals("POCKET") && event.a() == 0 && event.b() == 0);
        assertThat(cue.pocketed).isTrue();
        assertThat(result.frames().get(result.frames().size() - 1)).containsExactly(-1, -1);
    }
}
