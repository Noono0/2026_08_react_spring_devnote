package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * 섯다(2~4명, 두 장 섯다). 화투 20장(1~10월 × 2장), 칩은 게임 안의 가상 점수.
 *
 * [한 판]
 *   1. 판돈: 모두 10칩을 낸다.  2. 두 장씩 받는다(남의 패는 끝날 때까지 안 보인다).
 *   3. 베팅(BettingRound): 체크·콜·레이즈·다이. 4. 남은 사람끼리 패를 비교해 가장 높은 사람이 판돈을 가져간다(같으면 나눔).
 * [족보] 높은 순
 *   38광땡 > 광땡(13·18) > 땡(장땡 10땡 ~ 1땡) > 알리(1·2) > 독사(1·4) > 구삥(1·9) > 장삥(1·10) > 장사(10·4) > 세륙(4·6)
 *   > 끗(두 장 합의 끝자리: 갑오 9끗 ~ 망통 0끗)
 * [특수 패]
 *   암행어사(4열끗·7열끗): 평소 1끗, 상대에 광땡(13·18)이 있으면 그것을 잡는다.
 *   땡잡이(3광·7열끗): 평소 망통, 상대 최고가 1~9땡이면 그것을 잡는다.
 *   구사(4·9): 상대 최고가 알리 이하면 다시 한다. 멍텅구리구사(4열끗·9열끗)는 9땡 이하면 다시 한다.
 * [게임] 6판 뒤(또는 칩이 모자라 혼자 남으면) 칩이 가장 많은 사람이 이긴다.
 */
public class SutdaGame implements OnlineGame {
    public static final int START_CHIPS = 1000;
    public static final int ANTE = 10;
    public static final int MIN_RAISE = 10;
    public static final int MAX_ROUNDS = 6;
    private static final List<Integer> GWANG_MONTHS = List.of(1, 3, 8);
    private static final List<Integer> YEOL_MONTHS = List.of(4, 7, 9);

    /** 화투 한 장. special: 1·3·8월은 광, 4·7·9월은 열끗 */
    public record Card(int month, boolean special) {
        public String code() {
            if (!special) return month + "B";
            return month + (GWANG_MONTHS.contains(month) ? "G" : YEOL_MONTHS.contains(month) ? "Y" : "A");
        }
    }

    /** 족보 점수(클수록 높음)와 이름 */
    public record Hand(int score, String name) {}

    /** 지난 판: 패를 공개한 사람의 카드와 족보, 이긴 자리, 판돈 */
    public record RoundSummary(List<List<String>> cards, List<String> handNames, List<Integer> winners, int pot, boolean replay) {}

    public record View(String phase, int round, int maxRounds, Integer mySeat, List<String> myCards, List<Integer> chips,
                       List<Boolean> inHand, List<Boolean> active, int pot, int currentBet, List<Integer> contributed,
                       int toCall, int minRaise, int maxRaise, Integer turnSeat, int dealerSeat, RoundSummary lastRound,
                       List<Integer> winners) {}

    private final List<String> nicknames;
    private final Random random;
    private final int players;
    private final int[] chips;
    private final boolean[] active;
    private final boolean[] inHand;
    private final List<List<Card>> hands = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private final List<Integer> winners = new ArrayList<>();
    private BettingRound betting;
    private RoundSummary lastRound;
    private int pot;
    private int round = 1;
    private int dealerSeat;
    private boolean finished;

    public SutdaGame(List<String> nicknames, Random random) {
        this.nicknames = List.copyOf(nicknames);
        this.random = random;
        this.players = nicknames.size();
        this.chips = new int[players];
        Arrays.fill(chips, START_CHIPS);
        this.active = new boolean[players];
        Arrays.fill(active, true);
        this.inHand = new boolean[players];
        for (int seat = 0; seat < players; seat++) hands.add(new ArrayList<>());
        startRound(null);
    }

    // ── 족보 ─────────────────────────────────────────────────────

    public static Hand rank(Card first, Card second) {
        int low = Math.min(first.month(), second.month());
        int high = Math.max(first.month(), second.month());
        boolean bothGwang = isGwang(first) && isGwang(second);
        if (bothGwang && low == 3 && high == 8) return new Hand(1000, "38광땡");
        if (bothGwang && low == 1 && (high == 3 || high == 8)) return new Hand(900, low + "" + high + "광땡");
        if (low == high) return new Hand(800 + low, low == 10 ? "장땡" : low + "땡");
        if (low == 1 && high == 2) return new Hand(700, "알리");
        if (low == 1 && high == 4) return new Hand(690, "독사");
        if (low == 1 && high == 9) return new Hand(680, "구삥");
        if (low == 1 && high == 10) return new Hand(670, "장삥");
        if (low == 4 && high == 10) return new Hand(660, "장사");
        if (low == 4 && high == 6) return new Hand(650, "세륙");
        int points = (low + high) % 10;
        return new Hand(points, points == 9 ? "갑오" : points == 0 ? "망통" : points + "끗");
    }

    private static boolean isGwang(Card card) {
        return card.special() && GWANG_MONTHS.contains(card.month());
    }

    private static boolean isYeol(Card card, int month) {
        return card.special() && card.month() == month;
    }

    private static boolean has(List<Card> hand, int month) {
        return hand.stream().anyMatch(card -> card.month() == month);
    }

    static boolean isAmhaeng(List<Card> hand) {
        return hand.stream().anyMatch(card -> isYeol(card, 4)) && hand.stream().anyMatch(card -> isYeol(card, 7));
    }

    static boolean isTtaengjabi(List<Card> hand) {
        return hand.stream().anyMatch(card -> card.month() == 3 && isGwang(card)) && hand.stream().anyMatch(card -> isYeol(card, 7));
    }

    static boolean isGusa(List<Card> hand) {
        return has(hand, 4) && has(hand, 9);
    }

    static boolean isMeongGusa(List<Card> hand) {
        return hand.stream().anyMatch(card -> isYeol(card, 4)) && hand.stream().anyMatch(card -> isYeol(card, 9));
    }

    /**
     * 남은 사람끼리 비교. 특수 패를 반영한 점수로 가장 높은 사람(들)을 고른다. 구사로 다시 해야 하면 null.
     */
    static List<Integer> showdown(List<List<Card>> hands, List<Integer> seats) {
        int[] scores = new int[hands.size()];
        for (int seat : seats) scores[seat] = rank(hands.get(seat).get(0), hands.get(seat).get(1)).score();
        for (int seat : seats) {
            List<Card> hand = hands.get(seat);
            int bestOther = seats.stream().filter(other -> other != seat).mapToInt(other -> scores[other]).max().orElse(-1);
            if (isAmhaeng(hand) && bestOther == 900) scores[seat] = 950;          // 광땡(13·18)을 잡는다
            else if (isTtaengjabi(hand) && bestOther >= 801 && bestOther <= 809) scores[seat] = 850; // 1~9땡을 잡는다
        }
        for (int seat : seats) {
            List<Card> hand = hands.get(seat);
            int bestOther = seats.stream().filter(other -> other != seat).mapToInt(other -> scores[other]).max().orElse(-1);
            if (isMeongGusa(hand) && bestOther <= 809) return null;
            if (isGusa(hand) && bestOther <= 700) return null;
        }
        int best = seats.stream().mapToInt(seat -> scores[seat]).max().orElse(-1);
        return seats.stream().filter(seat -> scores[seat] == best).toList();
    }

    // ── 진행 ─────────────────────────────────────────────────────

    /** 새 판: 판돈을 내고 두 장씩. carriedPot은 구사로 다시 할 때 넘어온 판돈 */
    private void startRound(Integer carriedPot) {
        List<Card> deck = new ArrayList<>();
        for (int month = 1; month <= 10; month++) {
            deck.add(new Card(month, true));
            deck.add(new Card(month, false));
        }
        Collections.shuffle(deck, random);
        pot = carriedPot == null ? 0 : carriedPot;
        for (int seat = 0; seat < players; seat++) {
            hands.get(seat).clear();
            inHand[seat] = active[seat];
            if (!active[seat]) continue;
            if (carriedPot == null) {
                chips[seat] -= ANTE;
                pot += ANTE;
            }
            hands.get(seat).add(deck.remove(0));
            hands.get(seat).add(deck.remove(0));
        }
        betting = new BettingRound(chips, inHand, nextActive(dealerSeat), MIN_RAISE);
        if (betting.isComplete()) endRound();
    }

    /** 테스트용: 패를 직접 정한다(코드 예: "3G", "8G", "4Y", "7B") */
    void setHands(List<List<String>> codes) {
        for (int seat = 0; seat < players; seat++) {
            hands.get(seat).clear();
            for (String code : codes.get(seat)) {
                int month = Integer.parseInt(code.substring(0, code.length() - 1));
                hands.get(seat).add(new Card(month, !code.endsWith("B")));
            }
        }
    }

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= players || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        String name = action.actionName();
        if (!List.of("CHECK", "CALL", "RAISE", "FOLD").contains(name)) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        betting.act(seat, name, action.number());
        if (name.equals("FOLD")) announcements.add(nicknames.get(seat) + "님 다이");
        if (betting.isComplete()) endRound();
    }

    private void endRound() {
        pot += betting.collect();
        List<Integer> remaining = new ArrayList<>();
        for (int seat = 0; seat < players; seat++) if (inHand[seat]) remaining.add(seat);
        List<Integer> roundWinners;
        boolean replay = false;
        if (remaining.size() == 1) {
            roundWinners = remaining;
        } else {
            roundWinners = showdown(hands, remaining);
            replay = roundWinners == null;
        }
        List<List<String>> shown = new ArrayList<>();
        List<String> names = new ArrayList<>();
        for (int seat = 0; seat < players; seat++) {
            boolean reveal = remaining.size() > 1 && remaining.contains(seat);
            shown.add(reveal ? hands.get(seat).stream().map(Card::code).toList() : List.of());
            names.add(reveal ? describe(hands.get(seat)) : null);
        }
        if (replay) {
            lastRound = new RoundSummary(shown, names, List.of(), pot, true);
            announcements.add("구사! 판돈 " + pot + "칩을 걸고 다시 합니다.");
            startRound(pot);
            return;
        }
        int share = pot / roundWinners.size();
        for (int seat : roundWinners) chips[seat] += share;
        chips[roundWinners.get(0)] += pot - share * roundWinners.size(); // 나머지 칩
        lastRound = new RoundSummary(shown, names, roundWinners, pot, false);
        announcements.add(round + "판: " + String.join(" · ", roundWinners.stream().map(nicknames::get).toList()) + " 승리 (+" + pot + "칩)");

        for (int seat = 0; seat < players; seat++) {
            if (active[seat] && chips[seat] < ANTE) {
                active[seat] = false;
                announcements.add(nicknames.get(seat) + "님은 칩이 모자라 빠집니다.");
            }
        }
        if (round >= MAX_ROUNDS || countActive() <= 1) {
            finish();
            return;
        }
        round++;
        dealerSeat = nextActive(dealerSeat);
        startRound(null);
    }

    private String describe(List<Card> hand) {
        if (isAmhaeng(hand)) return "암행어사";
        if (isTtaengjabi(hand)) return "땡잡이";
        if (isMeongGusa(hand)) return "멍텅구리구사";
        if (isGusa(hand)) return "구사";
        return rank(hand.get(0), hand.get(1)).name();
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
        chips[seat] = 0;
        announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
        if (countActive() <= 1) {
            if (inHand[seat]) inHand[seat] = false;
            pot += betting.collect();
            for (int candidate = 0; candidate < players; candidate++) if (active[candidate]) chips[candidate] += pot;
            pot = 0;
            finish();
            return;
        }
        betting.leave(seat);
        if (betting.isComplete()) endRound();
    }

    private int countActive() {
        int count = 0;
        for (boolean isActive : active) if (isActive) count++;
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
        return "섯다 " + String.join(" · ", parts);
    }

    @Override
    public Object viewFor(Integer seat) {
        boolean isPlayer = seat != null && seat >= 0 && seat < players;
        List<String> myCards = isPlayer && !finished ? hands.get(seat).stream().map(Card::code).toList() : List.of();
        List<Boolean> inHandList = new ArrayList<>();
        List<Boolean> activeList = new ArrayList<>();
        List<Integer> contributedList = new ArrayList<>();
        for (int index = 0; index < players; index++) {
            inHandList.add(inHand[index]);
            activeList.add(active[index]);
            contributedList.add(finished ? 0 : betting.contributed(index));
        }
        boolean open = !finished && !betting.isComplete(); // 지금 베팅 중인가
        return new View(finished ? "FINISHED" : "BETTING", round, MAX_ROUNDS, seat, myCards, Arrays.stream(chips).boxed().toList(),
            inHandList, activeList, finished ? 0 : pot + betting.collect(), open ? betting.currentBet() : 0, contributedList,
            isPlayer && open ? betting.toCall(seat) : 0, MIN_RAISE, isPlayer && open ? betting.maxRaise(seat) : 0,
            open ? betting.turnSeat() : null, dealerSeat, lastRound, List.copyOf(winners));
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
