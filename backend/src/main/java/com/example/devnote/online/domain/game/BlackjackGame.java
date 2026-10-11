package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Random;

/**
 * 블랙잭(1~4명이 딜러와 겨룬다). 칩은 게임 안에서만 쓰는 가상 점수다(실제 돈과 관계없음).
 *
 * [한 판]
 *   1. 베팅: 모두 10칩 이상 건다(가진 칩 안에서).
 *   2. 카드: 각자 2장, 딜러 2장(1장은 뒤집혀 딜러 차례까지 숨김).
 *   3. 자리 순서대로: 받기(HIT)·멈추기(STAND)·더블(DOUBLE — 처음 두 장일 때만, 베팅 2배로 한 장만 받고 멈춤).
 *      21을 넘으면 버스트(짐). 처음 두 장이 21(A + 10·J·Q·K)이면 블랙잭.
 *   4. 딜러: 숨긴 카드를 보이고 17 이상이 될 때까지 받는다.
 *   5. 정산: 블랙잭 1.5배, 이기면 1배를 받고 지면 건 만큼 잃는다. 같으면 무승부(그대로).
 * [게임] 5판을 하고 칩이 가장 많은 사람이 이긴다. 칩이 10 미만이면 더 걸 수 없어 빠진다.
 * [숨긴 정보] 딜러의 두 번째 카드는 딜러 차례 전까지 보내지 않는다. 플레이어 카드는 원래 모두에게 보인다.
 * (규칙을 단순하게 하려고 스플릿·보험은 넣지 않았다)
 */
public class BlackjackGame implements OnlineGame {
    public static final int START_CHIPS = 1000;
    public static final int MIN_BET = 10;
    public static final int MAX_ROUNDS = 5;

    public enum Phase { BETTING, PLAYING, FINISHED }

    /** 지난 판 결과: 칩 변화와 결과 이름 */
    public record RoundResult(int delta, String outcome) {}

    public record View(String phase, int round, int maxRounds, Integer mySeat, List<Integer> chips, List<Integer> bets,
                       List<List<PlayingCard.View>> hands, List<Integer> handValues, List<Boolean> done, List<Boolean> active,
                       List<PlayingCard.View> dealerCards, Integer dealerValue, boolean dealerHidden, Integer turnSeat,
                       List<RoundResult> lastResults, List<PlayingCard.View> lastDealerCards, List<Integer> winners) {}

    private final List<String> nicknames;
    private final Random random;
    private final int players;
    private final int[] chips;
    private final int[] bets;
    private final boolean[] active;
    private final boolean[] done;
    private final List<List<PlayingCard>> hands = new ArrayList<>();
    private final List<PlayingCard> dealer = new ArrayList<>();
    private final List<RoundResult> lastResults = new ArrayList<>();
    private final List<PlayingCard> lastDealer = new ArrayList<>();
    private final List<Integer> winners = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private Deque<PlayingCard> shoe = new ArrayDeque<>();
    private Phase phase = Phase.BETTING;
    private int round = 1;
    private int turnSeat = -1;

    public BlackjackGame(List<String> nicknames, Random random) {
        this.nicknames = List.copyOf(nicknames);
        this.random = random;
        this.players = nicknames.size();
        this.chips = new int[players];
        Arrays.fill(chips, START_CHIPS);
        this.bets = new int[players];
        this.active = new boolean[players];
        Arrays.fill(active, true);
        this.done = new boolean[players];
        for (int seat = 0; seat < players; seat++) hands.add(new ArrayList<>());
    }

    /** 손의 점수: A는 11로 세다가 21을 넘으면 1로 바꾼다. J·Q·K는 10 */
    public static int value(List<PlayingCard> cards) {
        int total = 0;
        int aces = 0;
        for (PlayingCard card : cards) {
            if (card.rank() == 1) { total += 11; aces++; }
            else total += Math.min(10, card.rank());
        }
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        return total;
    }

    public static boolean isBlackjack(List<PlayingCard> cards) {
        return cards.size() == 2 && value(cards) == 21;
    }

    /** 테스트용: 다음에 나눠 줄 카드 순서를 정한다(앞에서부터 꺼낸다) */
    void stackShoe(List<PlayingCard> cards) {
        shoe = new ArrayDeque<>(cards);
    }

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.FINISHED || seat < 0 || seat >= players || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        switch (action.actionName()) {
            case "BET" -> bet(seat, action.number());
            case "HIT", "STAND", "DOUBLE" -> decide(seat, action.actionName());
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void bet(int seat, Integer amount) {
        if (phase != Phase.BETTING) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "지금은 베팅할 수 없습니다.");
        if (bets[seat] > 0) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이미 걸었습니다.");
        if (amount == null || amount < MIN_BET || amount > chips[seat]) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, MIN_BET + "칩 이상, 가진 칩(" + chips[seat] + ") 이하로 걸어 주세요.");
        }
        bets[seat] = amount;
        if (allActiveBet()) deal();
    }

    private boolean allActiveBet() {
        for (int seat = 0; seat < players; seat++) if (active[seat] && bets[seat] == 0) return false;
        return true;
    }

    /** 카드 한 장. 남은 카드가 없으면 새 한 벌을 섞어 쓴다(판 중간에 떨어져도 멈추지 않게) */
    private PlayingCard drawCard() {
        if (shoe.isEmpty()) {
            List<PlayingCard> deck = new ArrayList<>(PlayingCard.deck(false));
            Collections.shuffle(deck, random);
            shoe = new ArrayDeque<>(deck);
        }
        return shoe.pop();
    }

    private void deal() {
        if (shoe.size() < 20) shoe.clear(); // 남은 카드가 적으면 새 한 벌로 시작(drawCard가 섞는다)
        dealer.clear();
        for (int seat = 0; seat < players; seat++) {
            hands.get(seat).clear();
            done[seat] = !active[seat];
        }
        for (int count = 0; count < 2; count++) {
            for (int seat = 0; seat < players; seat++) if (active[seat]) hands.get(seat).add(drawCard());
            dealer.add(drawCard());
        }
        for (int seat = 0; seat < players; seat++) {
            if (active[seat] && isBlackjack(hands.get(seat))) {
                done[seat] = true;
                announcements.add(nicknames.get(seat) + "님 블랙잭!");
            }
        }
        phase = Phase.PLAYING;
        advanceTurn();
    }

    private void decide(int seat, String decision) {
        if (phase != Phase.PLAYING) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "지금은 카드를 받을 수 없습니다.");
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        List<PlayingCard> hand = hands.get(seat);
        switch (decision) {
            case "HIT" -> {
                hand.add(drawCard());
                int total = value(hand);
                if (total > 21) announcements.add(nicknames.get(seat) + "님 버스트(" + total + ")");
                if (total >= 21) done[seat] = true;
            }
            case "STAND" -> done[seat] = true;
            default -> { // DOUBLE
                if (hand.size() != 2) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "더블은 처음 두 장일 때만 할 수 있습니다.");
                if (bets[seat] * 2 > chips[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "더블할 칩이 모자랍니다.");
                bets[seat] *= 2;
                hand.add(drawCard());
                done[seat] = true;
                if (value(hand) > 21) announcements.add(nicknames.get(seat) + "님 버스트(" + value(hand) + ")");
            }
        }
        if (done[seat]) advanceTurn();
    }

    /** 다음 결정할 사람. 모두 끝났으면 딜러 차례 → 정산 */
    private void advanceTurn() {
        for (int seat = 0; seat < players; seat++) {
            if (active[seat] && !done[seat]) {
                turnSeat = seat;
                return;
            }
        }
        turnSeat = -1;
        dealerPlay();
        settle();
    }

    private void dealerPlay() {
        boolean anyAlive = false;
        for (int seat = 0; seat < players; seat++) if (active[seat] && value(hands.get(seat)) <= 21) anyAlive = true;
        if (!anyAlive) return; // 모두 버스트면 딜러는 더 받지 않는다
        while (value(dealer) < 17) dealer.add(drawCard());
    }

    private void settle() {
        int dealerTotal = value(dealer);
        boolean dealerBlackjack = isBlackjack(dealer);
        lastResults.clear();
        for (int seat = 0; seat < players; seat++) {
            if (!active[seat]) {
                lastResults.add(new RoundResult(0, "빠짐"));
                continue;
            }
            List<PlayingCard> hand = hands.get(seat);
            int total = value(hand);
            int bet = bets[seat];
            RoundResult result;
            if (total > 21) result = new RoundResult(-bet, "버스트");
            else if (isBlackjack(hand) && !dealerBlackjack) result = new RoundResult(bet * 3 / 2, "블랙잭");
            else if (dealerBlackjack && !isBlackjack(hand)) result = new RoundResult(-bet, "딜러 블랙잭");
            else if (dealerTotal > 21) result = new RoundResult(bet, "딜러 버스트");
            else if (total > dealerTotal) result = new RoundResult(bet, "승");
            else if (total < dealerTotal) result = new RoundResult(-bet, "패");
            else result = new RoundResult(0, "무승부");
            chips[seat] += result.delta();
            lastResults.add(result);
        }
        lastDealer.clear();
        lastDealer.addAll(dealer);
        announcements.add(round + "판 끝 — 딜러 " + (dealerTotal > 21 ? "버스트(" + dealerTotal + ")" : dealerTotal));
        for (int seat = 0; seat < players; seat++) {
            bets[seat] = 0;
            if (active[seat] && chips[seat] < MIN_BET) {
                active[seat] = false;
                announcements.add(nicknames.get(seat) + "님은 칩이 모자라 빠집니다.");
            }
        }
        boolean anyActive = false;
        for (boolean isActive : active) anyActive |= isActive;
        if (round >= MAX_ROUNDS || !anyActive) {
            finish();
            return;
        }
        round++;
        phase = Phase.BETTING;
    }

    private void finish() {
        phase = Phase.FINISHED;
        turnSeat = -1;
        int best = Arrays.stream(chips).max().orElse(0);
        for (int seat = 0; seat < players; seat++) if (chips[seat] == best) winners.add(seat);
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.FINISHED || !active[seat]) return;
        active[seat] = false;
        bets[seat] = 0;
        chips[seat] = Math.min(chips[seat], 0); // 나가면 순위에서 맨 뒤
        announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
        boolean anyActive = false;
        for (boolean isActive : active) anyActive |= isActive;
        if (!anyActive) {
            finish();
            return;
        }
        if (phase == Phase.BETTING && allActiveBet()) deal();
        else if (phase == Phase.PLAYING && turnSeat == seat) {
            done[seat] = true;
            advanceTurn();
        }
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINISHED;
    }

    @Override
    public List<Integer> winnerSeats() {
        return List.copyOf(winners);
    }

    @Override
    public String resultText() {
        Integer[] order = new Integer[players];
        for (int seat = 0; seat < players; seat++) order[seat] = seat;
        Arrays.sort(order, (left, right) -> Integer.compare(chips[right], chips[left]));
        List<String> parts = new ArrayList<>();
        for (int index = 0; index < order.length; index++) parts.add((index + 1) + "위 " + nicknames.get(order[index]) + " " + chips[order[index]] + "칩");
        return "블랙잭 " + String.join(" · ", parts);
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean dealerHidden = phase == Phase.PLAYING; // 딜러 차례 전에는 두 번째 카드를 숨긴다
        List<PlayingCard.View> dealerCards = new ArrayList<>();
        for (int index = 0; index < dealer.size(); index++) dealerCards.add(dealerHidden && index == 1 ? null : dealer.get(index).view());
        Integer dealerValue = dealer.isEmpty() ? null : dealerHidden ? value(dealer.subList(0, 1)) : value(dealer);
        List<List<PlayingCard.View>> handViews = hands.stream().map(hand -> hand.stream().map(PlayingCard::view).toList()).toList();
        List<Integer> values = hands.stream().map(hand -> hand.isEmpty() ? 0 : value(hand)).toList();
        List<Boolean> doneList = new ArrayList<>();
        List<Boolean> activeList = new ArrayList<>();
        for (int index = 0; index < players; index++) {
            doneList.add(done[index]);
            activeList.add(active[index]);
        }
        return new View(phase.name(), round, MAX_ROUNDS, seat, Arrays.stream(chips).boxed().toList(), Arrays.stream(bets).boxed().toList(),
            handViews, values, doneList, activeList, phase == Phase.BETTING ? List.of() : dealerCards, phase == Phase.BETTING ? null : dealerValue,
            dealerHidden, phase == Phase.PLAYING ? turnSeat : null, List.copyOf(lastResults),
            lastDealer.stream().map(PlayingCard::view).toList(), List.copyOf(winners));
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
