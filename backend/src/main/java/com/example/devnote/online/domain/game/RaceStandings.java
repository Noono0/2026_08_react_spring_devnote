package com.example.devnote.online.domain.game;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.IntUnaryOperator;

/**
 * 각자 자기 판으로 겨루는 대전(2048 대전·지뢰 찾기 대전)의 공통 진행표.
 * 판 규칙은 게임 클래스가, "누가 끝났고 몇 위인가"는 이 클래스가 맡는다.
 *
 * [자리 상태]
 *   PLAYING(진행 중) → SUCCESS(목표 달성) 또는 FAILED(더 못 함·지뢰). 기권하거나 나가면 LEFT.
 *   성공·실패한 순서(finishOrder)를 1부터 기억한다.
 *
 * [언제 끝나나]
 *   진행 중인 자리가 하나도 없으면 끝난다. 한 명만 남아도 다른 사람이 성공·실패로 끝냈다면 그 사람은 끝까지 한다
 *   (남은 사람이 더 좋은 기록을 낼 수 있으므로). 단, 나머지가 모두 빠졌으면(LEFT) 다른 대전처럼 남은 사람이 바로 이긴다.
 *
 * [순위]
 *   1) 성공한 사람: cost(이동 수·클릭 수)가 적을수록 위, 같으면 먼저 끝낸 사람이 위
 *   2) 실패한 사람(바로 이긴 남은 사람 포함): score(점수·연 칸 수)가 클수록 위, 같으면 같은 순위
 *   3) 빠진 사람: 맨 아래(score로 나눈다). 빠진 사람은 이길 수 없다
 *   승자 = 1위인 자리들(실패끼리 같은 점수면 공동 승리).
 */
final class RaceStandings {
    enum Status { PLAYING, SUCCESS, FAILED, LEFT }

    private final Status[] statuses;
    private final int[] finishOrders;
    private int finishedCount;
    private boolean finished;

    RaceStandings(int seatCount) {
        this.statuses = new Status[seatCount];
        Arrays.fill(statuses, Status.PLAYING);
        this.finishOrders = new int[seatCount];
    }

    Status statusOf(int seat) {
        return statuses[seat];
    }

    /** 성공·실패한 순서(1부터). 아직 진행 중이거나 빠졌으면 null */
    Integer finishOrderOf(int seat) {
        return finishOrders[seat] == 0 ? null : finishOrders[seat];
    }

    boolean isPlaying(int seat) {
        return !finished && seat >= 0 && seat < statuses.length && statuses[seat] == Status.PLAYING;
    }

    boolean isFinished() {
        return finished;
    }

    void succeed(int seat) {
        settle(seat, Status.SUCCESS);
    }

    void fail(int seat) {
        settle(seat, Status.FAILED);
    }

    /** 기권·나감. 이미 성공·실패한 자리는 결과를 그대로 둔다. 실제로 빠졌으면 true */
    boolean leave(int seat) {
        if (!isPlaying(seat)) return false;
        statuses[seat] = Status.LEFT;
        long playing = count(Status.PLAYING);
        boolean othersAllLeft = count(Status.SUCCESS) + count(Status.FAILED) == 0;
        if (playing == 0 || (playing == 1 && othersAllLeft)) finished = true;
        return true;
    }

    private void settle(int seat, Status status) {
        statuses[seat] = status;
        finishOrders[seat] = ++finishedCount;
        if (count(Status.PLAYING) == 0) finished = true;
    }

    /** 자리마다 순위(1부터, 같은 기록은 같은 순위) */
    int[] ranks(IntUnaryOperator cost, IntUnaryOperator score) {
        int[] ranks = new int[statuses.length];
        for (int seat = 0; seat < statuses.length; seat++) {
            int better = 0;
            for (int other = 0; other < statuses.length; other++) {
                if (compare(other, seat, cost, score) < 0) better++;
            }
            ranks[seat] = better + 1;
        }
        return ranks;
    }

    /** 끝났을 때 이긴 자리(1위, 빠진 사람 제외). 끝나기 전이면 빈 목록 */
    List<Integer> winners(IntUnaryOperator cost, IntUnaryOperator score) {
        if (!finished) return List.of();
        int[] ranks = ranks(cost, score);
        List<Integer> winners = new ArrayList<>();
        for (int seat = 0; seat < statuses.length; seat++) {
            if (ranks[seat] == 1 && statuses[seat] != Status.LEFT) winners.add(seat);
        }
        return winners;
    }

    /** 음수면 left가 더 좋은 기록 */
    private int compare(int left, int right, IntUnaryOperator cost, IntUnaryOperator score) {
        int groupDifference = group(left) - group(right);
        if (groupDifference != 0) return groupDifference;
        if (statuses[left] == Status.SUCCESS) {
            int costDifference = Integer.compare(cost.applyAsInt(left), cost.applyAsInt(right));
            return costDifference != 0 ? costDifference : Integer.compare(finishOrders[left], finishOrders[right]);
        }
        return Integer.compare(score.applyAsInt(right), score.applyAsInt(left));
    }

    private int group(int seat) {
        return switch (statuses[seat]) {
            case SUCCESS -> 0;
            case FAILED, PLAYING -> 1;
            case LEFT -> 2;
        };
    }

    private long count(Status status) {
        return Arrays.stream(statuses).filter(candidate -> candidate == status).count();
    }
}
