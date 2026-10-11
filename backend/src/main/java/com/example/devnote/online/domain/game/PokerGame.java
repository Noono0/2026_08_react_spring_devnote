package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 포커(텍사스 홀덤, 2~4명). 칩은 게임 안의 가상 점수다.
 *
 * [한 판]
 *   1. 블라인드: 딜러 다음 사람이 스몰 블라인드(10), 그다음이 빅 블라인드(20)를 미리 낸다(둘이면 딜러가 스몰).
 *   2. 각자 2장(내 카드). 베팅(프리플랍) → 공용 카드 3장(플랍) → 베팅 → 1장(턴) → 베팅 → 1장(리버) → 베팅
 *   3. 끝까지 남은 사람끼리 내 2장 + 공용 5장 중 가장 좋은 5장으로 겨룬다(같으면 나눔). 혼자 남으면 바로 가져간다.
 * [게임] 6판 뒤(또는 칩이 빅 블라인드보다 적어 혼자 남으면) 칩이 가장 많은 사람이 이긴다.
 * [단순화] 사이드 팟 대신 한 바퀴 최대 금액을 가장 적은 칩까지로 제한(BettingRound).
 * [숨긴 정보] 남의 2장은 끝까지 간 판에서만(지난 판 결과로) 공개한다.
 */
public class PokerGame implements OnlineGame {
    public static final int START_CHIPS = 1000;
    public static final int SMALL_BLIND = 10;
    public static final int BIG_BLIND = 20;
    public static final int MAX_HANDS = 6;
    private static final String[] STREETS = {"프리플랍", "플랍", "턴", "리버"};

    public record HandSummary(List<List<PlayingCard.View>> cards, List<String> handNames, List<PlayingCard.View> board,
                              List<Integer> winners, int pot) {}

    public record View(String phase, int handNumber, int maxHands, String street, Integer mySeat, List<PlayingCard.View> myCards,
                       List<PlayingCard.View> board, List<Integer> chips, List<Boolean> inHand, List<Boolean> active, int pot,
                       int currentBet, List<Integer> contributed, int toCall, int minRaise, int maxRaise, Integer turnSeat,
                       int dealerSeat, HandSummary lastHand, List<Integer> winners) {}

    private final List<String> nicknames;
    private final Random random;
    private final int players;
    private final int[] chips;
    private final boolean[] active;
    private final boolean[] inHand;
    private final List<List<PlayingCard>> holes = new ArrayList<>();
    private final List<PlayingCard> board = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private final List<Integer> winners = new ArrayList<>();
    private Deque<PlayingCard> deck = new ArrayDeque<>();
    private BettingRound betting;
    private HandSummary lastHand;
    private int pot;
    private int street;
    private int handNumber = 1;
    private int dealerSeat;
    private boolean finished;

    public PokerGame(List<String> nicknames, Random random) {
        this.nicknames = List.copyOf(nicknames);
        this.random = random;
        this.players = nicknames.size();
        this.chips = new int[players];
        Arrays.fill(chips, START_CHIPS);
        this.active = new boolean[players];
        Arrays.fill(active, true);
        this.inHand = new boolean[players];
        for (int seat = 0; seat < players; seat++) holes.add(new ArrayList<>());
        startHand();
    }

    private void startHand() {
        List<PlayingCard> cards = new ArrayList<>(PlayingCard.deck(false));
        Collections.shuffle(cards, random);
        deck = new ArrayDeque<>(cards);
        board.clear();
        pot = 0;
        street = 0;
        for (int seat = 0; seat < players; seat++) {
            holes.get(seat).clear();
            inHand[seat] = active[seat];
        }
        for (int count = 0; count < 2; count++) for (int seat = 0; seat < players; seat++) if (active[seat]) holes.get(seat).add(deck.pop());
        boolean headsUp = countActive() == 2;
        int smallBlind = headsUp ? dealerSeat : nextActive(dealerSeat);
        int bigBlind = nextActive(smallBlind);
        int firstToAct = nextActive(bigBlind);
        betting = BettingRound.withBlinds(chips, inHand, firstToAct, BIG_BLIND, Map.of(smallBlind, SMALL_BLIND, bigBlind, BIG_BLIND));
        if (betting.isComplete()) advanceStreet();
    }

    /** 테스트용: 내 카드·공용 카드에 쓸 순서를 정한다 */
    void setCards(List<List<String>> holeCodes, List<String> nextBoard) {
        List<PlayingCard> all = PlayingCard.deck(false);
        for (int seat = 0; seat < players; seat++) {
            holes.get(seat).clear();
            for (String code : holeCodes.get(seat)) holes.get(seat).add(all.stream().filter(card -> card.code().equals(code)).findFirst().orElseThrow());
        }
        Deque<PlayingCard> stacked = new ArrayDeque<>();
        for (String code : nextBoard) stacked.add(all.stream().filter(card -> card.code().equals(code)).findFirst().orElseThrow());
        stacked.addAll(deck);
        deck = stacked;
    }

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= players || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        String name = action.actionName();
        if (!List.of("CHECK", "CALL", "RAISE", "FOLD").contains(name)) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        betting.act(seat, name, action.number());
        if (name.equals("FOLD")) announcements.add(nicknames.get(seat) + "님 폴드");
        if (betting.isComplete()) advanceStreet();
    }

    /** 베팅 한 바퀴가 끝남 → 팟에 모으고 다음 카드, 또는 승부 */
    private void advanceStreet() {
        while (true) {
            pot += betting.collect();
            if (countInHand() <= 1 || street == 3) {
                endHand();
                return;
            }
            street++;
            int cardsToDeal = street == 1 ? 3 : 1;
            for (int count = 0; count < cardsToDeal; count++) board.add(deck.pop());
            betting = new BettingRound(chips, inHand, nextActive(dealerSeat), BIG_BLIND);
            if (!betting.isComplete()) return; // 아무도 더 걸 수 없으면(칩 0) 다음 카드로 바로
        }
    }

    private void endHand() {
        List<Integer> remaining = new ArrayList<>();
        for (int seat = 0; seat < players; seat++) if (inHand[seat]) remaining.add(seat);
        List<Integer> handWinners;
        List<String> names = new ArrayList<>(Collections.nCopies(players, (String) null));
        List<List<PlayingCard.View>> shown = new ArrayList<>();
        for (int seat = 0; seat < players; seat++) shown.add(List.of());
        if (remaining.size() == 1) {
            handWinners = remaining;
        } else {
            while (board.size() < 5) board.add(deck.pop()); // 모두 칩이 없어 바로 끝까지 간 경우
            long best = Long.MIN_VALUE;
            long[] scores = new long[players];
            for (int seat : remaining) {
                List<PlayingCard> seven = new ArrayList<>(holes.get(seat));
                seven.addAll(board);
                PokerHands.Result result = PokerHands.best(seven);
                scores[seat] = result.score();
                names.set(seat, result.name());
                shown.set(seat, holes.get(seat).stream().map(PlayingCard::view).toList());
                best = Math.max(best, result.score());
            }
            long top = best;
            handWinners = remaining.stream().filter(seat -> scores[seat] == top).toList();
        }
        int share = pot / handWinners.size();
        for (int seat : handWinners) chips[seat] += share;
        chips[handWinners.get(0)] += pot - share * handWinners.size();
        lastHand = new HandSummary(shown, names, board.stream().map(PlayingCard::view).toList(), handWinners, pot);
        announcements.add(handNumber + "판: " + String.join(" · ", handWinners.stream().map(nicknames::get).toList()) + " 승리 (+" + pot + "칩)"
            + (remaining.size() > 1 && names.get(handWinners.get(0)) != null ? " — " + names.get(handWinners.get(0)) : ""));
        for (int seat = 0; seat < players; seat++) {
            if (active[seat] && chips[seat] < BIG_BLIND) {
                active[seat] = false;
                announcements.add(nicknames.get(seat) + "님은 칩이 모자라 빠집니다.");
            }
        }
        if (handNumber >= MAX_HANDS || countActive() <= 1) {
            finish();
            return;
        }
        handNumber++;
        dealerSeat = nextActive(dealerSeat);
        startHand();
    }

    private void finish() {
        finished = true;
        int best = Arrays.stream(chips).max().orElse(0);
        for (int seat = 0; seat < players; seat++) if (chips[seat] == best) winners.add(seat);
    }

    @Override
    public void leave(int seat) {
        if (finished || !active[seat]) return;
        active[seat] = false;
        announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
        if (countActive() <= 1) {
            inHand[seat] = false;
            pot += betting.collect();
            for (int candidate = 0; candidate < players; candidate++) if (active[candidate]) chips[candidate] += pot;
            pot = 0;
            chips[seat] = 0;
            finish();
            return;
        }
        betting.leave(seat);
        chips[seat] = 0;
        if (betting.isComplete()) advanceStreet();
    }

    private int countActive() {
        int count = 0;
        for (boolean isActive : active) if (isActive) count++;
        return count;
    }

    private int countInHand() {
        int count = 0;
        for (boolean in : inHand) if (in) count++;
        return count;
    }

    private int nextActive(int seat) {
        for (int step = 1; step <= players; step++) {
            int candidate = (seat + step) % players;
            if (active[candidate]) return candidate;
        }
        return seat;
    }

    @Override
    public boolean isFinished() {
        return finished;
    }

    @Override
    public String resultText() {
        Integer[] order = new Integer[players];
        for (int seat = 0; seat < players; seat++) order[seat] = seat;
        Arrays.sort(order, (left, right) -> Integer.compare(chips[right], chips[left]));
        List<String> parts = new ArrayList<>();
        for (int index = 0; index < order.length; index++) parts.add((index + 1) + "위 " + nicknames.get(order[index]) + " " + chips[order[index]] + "칩");
        return "포커 " + String.join(" · ", parts);
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean isPlayer = seat != null && seat >= 0 && seat < players;
        boolean open = !finished && !betting.isComplete();
        List<PlayingCard.View> myCards = isPlayer && !finished ? holes.get(seat).stream().map(PlayingCard::view).toList() : List.of();
        List<Boolean> inHandList = new ArrayList<>();
        List<Boolean> activeList = new ArrayList<>();
        List<Integer> contributedList = new ArrayList<>();
        for (int index = 0; index < players; index++) {
            inHandList.add(inHand[index]);
            activeList.add(active[index]);
            contributedList.add(finished ? 0 : betting.contributed(index));
        }
        return new View(finished ? "FINISHED" : "BETTING", handNumber, MAX_HANDS, STREETS[street], seat, myCards,
            finished ? List.of() : board.stream().map(PlayingCard::view).toList(), Arrays.stream(chips).boxed().toList(), inHandList, activeList,
            finished ? 0 : pot + betting.collect(), open ? betting.currentBet() : 0, contributedList,
            isPlayer && open ? betting.toCall(seat) : 0, BIG_BLIND, isPlayer && open ? betting.maxRaise(seat) : 0,
            open ? betting.turnSeat() : null, dealerSeat, lastHand, List.copyOf(winners));
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
