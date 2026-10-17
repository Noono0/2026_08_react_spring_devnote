package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * 섯다(2~4명). 화투 20장(1~10월 × 2장), 칩은 게임 안의 가상 점수. 방 옵션으로 2장 섯다·3장 섯다를 고른다.
 *
 * [한 판 — 2장 섯다]
 *   1. 판돈: 모두 10칩을 낸다.  2. 두 장씩 받는다(남의 패는 끝날 때까지 안 보인다).
 *   3. 베팅(BettingRound): 체크·콜·레이즈·다이. 4. 남은 사람끼리 패를 비교해 가장 높은 사람이 판돈을 가져간다(같으면 나눔).
 * [한 판 — 3장 섯다]
 *   두 장 받고 첫 베팅 → 남은 사람만 한 장 더 받음 → 세 장 중 보여 줄 두 장을 고름(CHOOSE) → 두 번째 베팅 → 고른 두 장으로 비교.
 *   ★ 서버가 "가장 좋은 두 장"을 대신 고르지 않는다. 땡잡이·암행어사처럼 상대 패에 따라 값이 달라지는 패가 있어
 *     무엇을 남길지가 이 게임의 수 싸움이기 때문이다. 대신 세 가지 조합의 족보 이름을 보여 준다(myCombos).
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

    /** 방 옵션: 2장 섯다(TWO)·3장 섯다(THREE) */
    public enum Mode { TWO, THREE }

    /** 3장 섯다에서 고를 수 있는 두 장 조합(내 패 안의 위치)과 그 족보 이름 */
    public record Combo(List<Integer> cards, String name) {}

    /** 지난 판: 패를 공개한 사람의 카드와 족보, 이긴 자리, 판돈 */
    public record RoundSummary(List<List<String>> cards, List<String> handNames, List<Integer> winners, int pot, boolean replay) {}

    /**
     * phase: BETTING(베팅 중) · CHOOSE(3장 섯다에서 두 장 고르는 중) · FINISHED
     * myHandName: 지금 내 두 장의 족보(3장 섯다는 고른 뒤에만). myCombos: 3장 섯다에서 세 장을 받았을 때의 세 가지 조합
     * chosen: 자리마다 두 장을 골랐는지(무엇을 골랐는지는 공개하지 않는다)
     */
    public record View(String mode, String phase, int round, int maxRounds, Integer mySeat, List<String> myCards, List<Integer> myChosen,
                       String myHandName, List<Combo> myCombos, List<Boolean> chosen, List<Integer> cardCounts, List<Integer> chips,
                       List<Boolean> inHand, List<Boolean> active, int pot, int currentBet, List<Integer> contributed,
                       int toCall, int minRaise, int maxRaise, Integer turnSeat, int dealerSeat, RoundSummary lastRound,
                       List<Integer> winners) {}

    private final List<String> nicknames;
    private final Random random;
    private final Mode mode;
    private final int players;
    private final int[] chips;
    private final boolean[] active;
    private final boolean[] inHand;
    private final List<List<Card>> hands = new ArrayList<>();
    /** 3장 섯다: 자리마다 고른 두 장의 위치. 아직 안 골랐으면 null */
    private final List<List<Integer>> chosenIndexes = new ArrayList<>();
    private final List<Card> deck = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    private final List<Integer> winners = new ArrayList<>();
    /** 지금 베팅 바퀴. 3장 섯다에서 두 장을 고르는 동안에는 null */
    private BettingRound betting;
    private boolean choosing;
    /** 3장 섯다: 이번 판에 세 번째 카드를 이미 나눠 줬는지(첫 베팅과 두 번째 베팅을 구분한다) */
    private boolean thirdCardDealt;
    private RoundSummary lastRound;
    private int pot;
    private int round = 1;
    private int dealerSeat;
    private boolean finished;

    public SutdaGame(List<String> nicknames, Random random) {
        this(nicknames, random, Mode.TWO);
    }

    /** 방 옵션 값("TWO"·"THREE") → 모드. 옵션이 없던 예전 방은 2장 섯다 */
    public static Mode modeFor(String option) {
        return option == null ? Mode.TWO : Mode.valueOf(option);
    }

    public SutdaGame(List<String> nicknames, Random random, Mode mode) {
        this.mode = mode;
        this.nicknames = List.copyOf(nicknames);
        this.random = random;
        this.players = nicknames.size();
        this.chips = new int[players];
        Arrays.fill(chips, START_CHIPS);
        this.active = new boolean[players];
        Arrays.fill(active, true);
        this.inHand = new boolean[players];
        for (int seat = 0; seat < players; seat++) {
            hands.add(new ArrayList<>());
            chosenIndexes.add(null);
        }
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
        // hands에는 자리마다 "비교할 두 장"이 들어 있다(3장 섯다는 고른 두 장)
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
        deck.clear();
        for (int month = 1; month <= 10; month++) {
            deck.add(new Card(month, true));
            deck.add(new Card(month, false));
        }
        Collections.shuffle(deck, random);
        pot = carriedPot == null ? 0 : carriedPot;
        choosing = false;
        thirdCardDealt = false;
        for (int seat = 0; seat < players; seat++) {
            hands.get(seat).clear();
            chosenIndexes.set(seat, null);
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
        if (betting.isComplete()) afterBetting();
    }

    /** 테스트용: 패를 직접 정한다(코드 예: "3G", "8G", "4Y", "7B") */
    void setHands(List<List<String>> codes) {
        for (int seat = 0; seat < players; seat++) {
            hands.get(seat).clear();
            for (String code : codes.get(seat)) hands.get(seat).add(parse(code));
        }
    }

    /** 테스트용: 3장 섯다에서 다음에 나눠 줄 카드를 맨 앞에 놓는다 */
    void putOnTopOfDeck(List<String> codes) {
        for (int index = codes.size() - 1; index >= 0; index--) deck.add(0, parse(codes.get(index)));
    }

    private static Card parse(String code) {
        int month = Integer.parseInt(code.substring(0, code.length() - 1));
        return new Card(month, !code.endsWith("B"));
    }

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= players || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        String name = action.actionName();
        if (name.equals("CHOOSE")) {
            choose(seat, action.numbers());
            return;
        }
        if (!List.of("CHECK", "CALL", "RAISE", "FOLD").contains(name)) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        if (choosing) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "먼저 보여 줄 두 장을 골라 주세요.");
        betting.act(seat, name, action.number());
        if (name.equals("FOLD")) announcements.add(nicknames.get(seat) + "님 다이");
        if (betting.isComplete()) afterBetting();
    }

    /** 이번 베팅 바퀴에 모인 칩(두 장 고르는 동안에는 바퀴가 없으므로 0) */
    private int bettingTotal() {
        return betting == null ? 0 : betting.collect();
    }

    private int countInHand() {
        int count = 0;
        for (boolean in : inHand) if (in) count++;
        return count;
    }

    /**
     * 베팅 바퀴가 끝났을 때. 3장 섯다의 첫 바퀴이고 둘 이상 남았으면 세 번째 카드를 주고 고르기로 넘어간다.
     * 그 밖에는 판을 마무리한다.
     */
    private void afterBetting() {
        if (mode == Mode.THREE && !thirdCardDealt && countInHand() > 1) {
            pot += bettingTotal();
            betting = null;
            choosing = true;
            thirdCardDealt = true;
            for (int seat = 0; seat < players; seat++) if (inHand[seat]) hands.get(seat).add(deck.remove(0));
            announcements.add("세 번째 패를 나눠 줬습니다. 보여 줄 두 장을 골라 주세요.");
            return;
        }
        endRound();
    }

    /** 3장 섯다: 보여 줄 두 장(numbers = [위치, 위치]). 모두 고르면 두 번째 베팅을 시작한다. 다 고르기 전에는 바꿀 수 있다 */
    private void choose(int seat, List<Integer> numbers) {
        if (!choosing) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "지금은 패를 고를 때가 아닙니다.");
        if (!inHand[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "다이한 사람은 고를 수 없습니다.");
        // ★ List.of로 만든 목록은 contains(null)에서 NullPointerException을 던진다. stream으로 null을 찾는다
        if (numbers == null || numbers.size() != 2 || numbers.stream().anyMatch(java.util.Objects::isNull)) {
            throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
        int first = numbers.get(0);
        int second = numbers.get(1);
        if (first == second || first < 0 || second < 0 || first > 2 || second > 2) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "세 장 중 서로 다른 두 장을 골라 주세요.");
        }
        chosenIndexes.set(seat, List.of(Math.min(first, second), Math.max(first, second)));
        startSecondBettingIfReady();
    }

    private void startSecondBettingIfReady() {
        for (int seat = 0; seat < players; seat++) if (inHand[seat] && chosenIndexes.get(seat) == null) return;
        choosing = false;
        announcements.add("모두 두 장을 골랐습니다. 마지막 베팅!");
        betting = new BettingRound(chips, inHand, nextActive(dealerSeat), MIN_RAISE);
        if (betting.isComplete()) endRound();
    }

    /** 비교할 두 장. 2장 섯다는 받은 패 그대로, 3장 섯다는 고른 두 장 */
    private List<Card> finalHand(int seat) {
        List<Card> hand = hands.get(seat);
        List<Integer> chosen = chosenIndexes.get(seat);
        if (hand.size() <= 2 || chosen == null) return hand.size() <= 2 ? hand : hand.subList(0, 2);
        return List.of(hand.get(chosen.get(0)), hand.get(chosen.get(1)));
    }

    private void endRound() {
        pot += bettingTotal();
        betting = null;
        choosing = false;
        List<Integer> remaining = new ArrayList<>();
        for (int seat = 0; seat < players; seat++) if (inHand[seat]) remaining.add(seat);
        List<List<Card>> finalHands = new ArrayList<>();
        for (int seat = 0; seat < players; seat++) finalHands.add(finalHand(seat));
        List<Integer> roundWinners;
        boolean replay = false;
        if (remaining.size() == 1) {
            roundWinners = remaining;
        } else {
            roundWinners = showdown(finalHands, remaining);
            replay = roundWinners == null;
        }
        List<List<String>> shown = new ArrayList<>();
        List<String> names = new ArrayList<>();
        for (int seat = 0; seat < players; seat++) {
            boolean reveal = remaining.size() > 1 && remaining.contains(seat);
            shown.add(reveal ? finalHands.get(seat).stream().map(Card::code).toList() : List.of());
            names.add(reveal ? describe(finalHands.get(seat)) : null);
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
            pot += bettingTotal();
            betting = null;
            for (int candidate = 0; candidate < players; candidate++) if (active[candidate]) chips[candidate] += pot;
            pot = 0;
            finish();
            return;
        }
        if (choosing) {
            // 두 장 고르는 중에 나가면 접은 것으로 보고, 남은 사람이 모두 골랐는지 다시 확인한다
            inHand[seat] = false;
            if (countInHand() <= 1) endRound();
            else startSecondBettingIfReady();
            return;
        }
        betting.leave(seat);
        if (betting.isComplete()) afterBetting();
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
        List<Card> myHand = isPlayer && !finished ? hands.get(seat) : List.of();
        List<String> myCards = myHand.stream().map(Card::code).toList();
        List<Integer> myChosen = isPlayer ? chosenIndexes.get(seat) : null;
        List<Boolean> inHandList = new ArrayList<>();
        List<Boolean> activeList = new ArrayList<>();
        List<Integer> contributedList = new ArrayList<>();
        List<Boolean> chosenList = new ArrayList<>();
        List<Integer> cardCounts = new ArrayList<>();
        for (int index = 0; index < players; index++) {
            cardCounts.add(finished ? 0 : hands.get(index).size()); // 남의 패 "장수"만(뒷면을 몇 장 그릴지)
            inHandList.add(inHand[index]);
            activeList.add(active[index]);
            contributedList.add(betting == null ? 0 : betting.contributed(index));
            chosenList.add(chosenIndexes.get(index) != null);
        }
        // ★ 족보 이름도 서버가 알려 준다. 화면에 같은 족보 규칙을 한 번 더 만들면 두 곳이 어긋날 수 있다.
        String myHandName = null;
        List<Combo> myCombos = List.of();
        if (myHand.size() == 2) myHandName = describe(myHand);
        if (myHand.size() == 3) {
            myCombos = List.of(combo(myHand, 0, 1), combo(myHand, 0, 2), combo(myHand, 1, 2));
            if (myChosen != null) myHandName = describe(finalHand(seat));
        }
        boolean open = !finished && betting != null && !betting.isComplete(); // 지금 베팅 중인가
        String phase = finished ? "FINISHED" : choosing ? "CHOOSE" : "BETTING";
        return new View(mode.name(), phase, round, MAX_ROUNDS, seat, myCards, myChosen, myHandName, myCombos, chosenList, cardCounts,
            Arrays.stream(chips).boxed().toList(),
            inHandList, activeList, finished ? 0 : pot + bettingTotal(), open ? betting.currentBet() : 0, contributedList,
            isPlayer && open ? betting.toCall(seat) : 0, MIN_RAISE, isPlayer && open ? betting.maxRaise(seat) : 0,
            open ? betting.turnSeat() : null, dealerSeat, lastRound, List.copyOf(winners));
    }

    private Combo combo(List<Card> hand, int first, int second) {
        return new Combo(List.of(first, second), describe(List.of(hand.get(first), hand.get(second))));
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
