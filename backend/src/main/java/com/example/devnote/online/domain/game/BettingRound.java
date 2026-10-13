package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/**
 * 베팅 한 바퀴(섯다·포커 공용). 칩은 게임 안의 가상 점수다.
 *
 * [행동]
 *   CHECK : 더 걸 것이 없을 때 그대로 넘긴다(지금 낸 칩 = 현재 베팅)
 *   CALL  : 현재 베팅만큼 맞춘다
 *   RAISE : 현재 베팅보다 amount만큼 더 올린다(최소 minRaise). 다른 사람은 다시 결정해야 한다
 *   FOLD  : 이번 판을 포기한다(다이)
 *
 * [단순화 — 사이드 팟 없음]
 *   실제 포커는 칩이 모자란 사람이 올인하면 "사이드 팟"을 따로 나눈다. 학습용으로는 너무 복잡하므로,
 *   한 바퀴에 낼 수 있는 칩을 "아직 남은 사람 중 가장 적게 가진 사람의 칩"(cap)까지로 제한한다.
 *   그러면 모두가 같은 금액을 낼 수 있어 팟이 하나로 끝난다.
 *
 * chips 배열은 게임의 칩을 그대로 받아 바꾼다(낸 만큼 줄어든다). 바퀴가 끝나면 collect()로 이번 바퀴에 낸 합을 팟에 더한다.
 */
public class BettingRound {
    private final int[] chips;
    private final boolean[] inHand;
    private final int[] contributed;
    private final boolean[] acted;
    private final int minRaise;
    private final int cap;
    private int currentBet;
    private int turnSeat;

    /**
     * @param inHand 이번 판에 남아 있는 사람(접으면 false로 바뀐다 — 게임과 같은 배열을 함께 쓴다)
     * @param startSeat 먼저 결정할 자리
     */
    public BettingRound(int[] chips, boolean[] inHand, int startSeat, int minRaise) {
        this.chips = chips;
        this.inHand = inHand;
        this.contributed = new int[chips.length];
        this.acted = new boolean[chips.length];
        this.minRaise = minRaise;
        int smallest = Integer.MAX_VALUE;
        for (int seat = 0; seat < chips.length; seat++) if (inHand[seat]) smallest = Math.min(smallest, chips[seat]);
        this.cap = smallest == Integer.MAX_VALUE ? 0 : smallest;
        this.turnSeat = -1;
        // 아무도 더 걸 수 없으면(누군가 칩이 0) 이번 바퀴는 바로 끝난다
        this.turnSeat = cap == 0 ? -1 : findNext(startSeat - 1);
    }

    /**
     * 포커처럼 강제 베팅(블라인드)으로 시작하는 바퀴. blinds: 자리 → 미리 낼 칩(가진 칩과 cap을 넘지 않게 줄인다)
     * 블라인드를 낸 사람도 아직 "결정"한 것은 아니므로, 모두 콜하면 빅 블라인드에게 한 번 더 기회가 간다.
     */
    public static BettingRound withBlinds(int[] chips, boolean[] inHand, int startSeat, int minRaise, java.util.Map<Integer, Integer> blinds) {
        BettingRound round = new BettingRound(chips, inHand, startSeat, minRaise);
        blinds.forEach((seat, amount) -> {
            int paid = Math.min(amount, round.cap);
            round.pay(seat, paid);
            round.currentBet = Math.max(round.currentBet, paid);
        });
        round.turnSeat = round.cap == 0 ? -1 : round.findNext(startSeat - 1);
        return round;
    }

    public int turnSeat() {
        return turnSeat;
    }

    public int currentBet() {
        return currentBet;
    }

    public int cap() {
        return cap;
    }

    public int contributed(int seat) {
        return contributed[seat];
    }

    public int toCall(int seat) {
        return currentBet - contributed[seat];
    }

    public int minRaise() {
        return minRaise;
    }

    /** 이번 바퀴에서 더 올릴 수 있는 최대 금액(cap까지) */
    public int maxRaise(int seat) {
        return Math.max(0, cap - currentBet);
    }

    public boolean isComplete() {
        return turnSeat < 0;
    }

    public void act(int seat, String action, Integer amount) {
        if (isComplete()) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "베팅이 끝났습니다.");
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        switch (action) {
            case "CHECK" -> {
                if (toCall(seat) > 0) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "걸린 칩이 있어 체크할 수 없습니다. 콜하거나 다이하세요.");
            }
            case "CALL" -> pay(seat, toCall(seat));
            case "RAISE" -> {
                int raiseBy = amount == null ? 0 : amount;
                int maxRaise = maxRaise(seat);
                if (maxRaise <= 0) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이번 바퀴에는 더 올릴 수 없습니다(가장 적은 칩까지).");
                if (raiseBy < Math.min(minRaise, maxRaise) || raiseBy > maxRaise) {
                    throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, Math.min(minRaise, maxRaise) + "~" + maxRaise + "칩 사이로 올려 주세요.");
                }
                pay(seat, toCall(seat) + raiseBy);
                currentBet += raiseBy;
                for (int other = 0; other < acted.length; other++) acted[other] = false; // 올리면 다른 사람은 다시 결정
            }
            case "FOLD" -> inHand[seat] = false;
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
        acted[seat] = true;
        turnSeat = findNext(seat);
    }

    /** 나간 사람: 접은 것으로 처리 */
    public void leave(int seat) {
        inHand[seat] = false;
        if (turnSeat == seat) turnSeat = findNext(seat);
        else if (!isComplete() && remaining() <= 1) turnSeat = -1;
    }

    private void pay(int seat, int amount) {
        chips[seat] -= amount;
        contributed[seat] += amount;
    }

    private int remaining() {
        int count = 0;
        for (boolean in : inHand) if (in) count++;
        return count;
    }

    /** seat 다음으로 결정할 사람. 모두 끝났으면 -1 */
    private int findNext(int seat) {
        if (remaining() <= 1) return -1;
        for (int step = 1; step <= chips.length; step++) {
            int candidate = Math.floorMod(seat + step, chips.length);
            if (!inHand[candidate]) continue;
            boolean needsAction = !acted[candidate] || contributed[candidate] < currentBet;
            if (needsAction) return candidate;
        }
        return -1;
    }

    /** 이번 바퀴에 모두가 낸 칩의 합(팟에 더한다) */
    public int collect() {
        int total = 0;
        for (int value : contributed) total += value;
        return total;
    }
}
