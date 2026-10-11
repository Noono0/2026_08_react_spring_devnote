package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Random;

/**
 * 원카드(2~4명). 52장 + 조커 2장, 처음에 7장씩.
 *
 * [내기]
 *   맨 위 카드와 무늬 또는 숫자가 같은 카드 한 장을 낸다. 조커는 언제든 낼 수 있고, 조커 다음 사람은 아무 카드나 낸다.
 *   낼 카드가 없으면(또는 내기 싫으면) "한 장 받기"로 1장을 받고 차례를 넘긴다.
 *
 * [특수 카드]
 *   공격: A +3, 2 +2, 흑백 조커 +5, 컬러 조커 +7 → 다음 사람이 그만큼 받아야 한다.
 *         공격받은 사람은 A·2(무늬나 숫자가 맞을 때)·조커로 막아 더 쌓아 넘길 수 있고, 못 막으면 쌓인 장수를 모두 받는다.
 *   7: 낸 사람이 다음 무늬를 정한다 · J: 다음 사람을 건너뛴다 · Q: 순서를 거꾸로 · K: 한 번 더 낸다
 *
 * [끝]
 *   손의 카드를 모두 내면 그 순서대로 1위, 2위…. 카드가 20장 이상 쌓이면 파산(탈락, 뒤 순위).
 *   한 명만 남으면 끝난다. 남의 손 카드는 보내지 않고 장수만 알려 준다.
 */
public class OneCardGame implements OnlineGame {
    public static final int START_HAND = 7;
    public static final int BANKRUPT_SIZE = 20;

    public record View(Integer mySeat, List<PlayingCard.View> myHand, List<Integer> handCounts, PlayingCard.View top,
                       String currentSuit, boolean anyCard, int attackPenalty, int direction, Integer turnSeat,
                       int drawPileCount, List<Boolean> active, List<Integer> ranks, boolean finished) {}

    private final List<String> nicknames;
    private final Random random;
    private final List<PlayingCard> deck;
    private final List<List<Integer>> hands = new ArrayList<>();
    private final Deque<Integer> drawPile = new ArrayDeque<>();
    private final List<Integer> discard = new ArrayList<>();
    private final boolean[] active;
    private final int[] ranks;
    private final List<String> announcements = new ArrayList<>();
    private String currentSuit;
    /** 조커 다음: 아무 카드나 낼 수 있음 */
    private boolean anyCard;
    private int attackPenalty;
    private int direction = 1;
    private int turnSeat;
    private int nextRank = 1;
    private int nextLoserRank;
    private boolean finished;

    public OneCardGame(List<String> nicknames, Random random) {
        this.nicknames = List.copyOf(nicknames);
        this.random = random;
        this.deck = PlayingCard.deck(true);
        this.active = new boolean[nicknames.size()];
        java.util.Arrays.fill(active, true);
        this.ranks = new int[nicknames.size()];
        this.nextLoserRank = nicknames.size();
        List<Integer> ids = new ArrayList<>();
        for (PlayingCard card : deck) ids.add(card.id());
        Collections.shuffle(ids, random);
        drawPile.addAll(ids);
        for (int seat = 0; seat < nicknames.size(); seat++) {
            List<Integer> hand = new ArrayList<>();
            for (int count = 0; count < START_HAND; count++) hand.add(drawPile.pop());
            hands.add(hand);
        }
        // 첫 카드는 특수 효과가 없는 카드가 나올 때까지 뒤집는다(조커·공격 카드로 시작하면 첫 사람이 억울하다)
        int first;
        do {
            first = drawPile.pop();
            discard.add(first);
        } while (isSpecial(deck.get(first)));
        currentSuit = deck.get(first).suit();
    }

    /** 테스트용: 손·맨 위 카드를 직접 정한다 */
    void setUp(List<List<String>> handCodes, String topCode) {
        for (int seat = 0; seat < hands.size(); seat++) {
            hands.get(seat).clear();
            for (String code : handCodes.get(seat)) hands.get(seat).add(idOf(code));
        }
        discard.clear();
        discard.add(idOf(topCode));
        currentSuit = deck.get(idOf(topCode)).suit();
        anyCard = false;
        attackPenalty = 0;
    }

    private int idOf(String code) {
        return deck.stream().filter(card -> card.code().equals(code)).findFirst().orElseThrow().id();
    }

    private static boolean isSpecial(PlayingCard card) {
        return card.isJoker() || card.rank() == 1 || card.rank() == 2 || card.rank() == 7 || card.rank() == 11 || card.rank() == 12 || card.rank() == 13;
    }

    private static int attackValue(PlayingCard card) {
        if (card.isJoker()) return "BJ".equals(card.suit()) ? 5 : 7;
        if (card.rank() == 1) return 3;
        if (card.rank() == 2) return 2;
        return 0;
    }

    private PlayingCard top() {
        return deck.get(discard.get(discard.size() - 1));
    }

    /** 지금 이 카드를 낼 수 있는지 */
    boolean canPlay(PlayingCard card) {
        PlayingCard top = top();
        boolean matches = card.isJoker() || anyCard || card.suit().equals(currentSuit) || (!top.isJoker() && card.rank() == top.rank());
        if (attackPenalty > 0) return attackValue(card) > 0 && matches; // 공격받는 중: 공격 카드로만 막는다
        return matches;
    }

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= active.length || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        switch (action.actionName()) {
            case "PLAY" -> play(seat, action.number(), action.text());
            case "DRAW" -> draw(seat);
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void play(int seat, Integer cardId, String chosenSuit) {
        List<Integer> hand = hands.get(seat);
        if (cardId == null || !hand.contains(cardId)) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "내 손에 없는 카드입니다.");
        PlayingCard card = deck.get(cardId);
        if (!canPlay(card)) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, attackPenalty > 0 ? "공격받는 중에는 A·2·조커로만 막을 수 있습니다." : "무늬나 숫자가 맞지 않습니다.");
        }
        if (card.rank() == 7 && (chosenSuit == null || !PlayingCard.SUITS.contains(chosenSuit))) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "7을 낼 때는 바꿀 무늬를 골라 주세요.");
        }
        hand.remove(cardId);
        discard.add(cardId);
        anyCard = card.isJoker();
        currentSuit = card.isJoker() ? null : card.rank() == 7 ? chosenSuit : card.suit();
        attackPenalty += attackValue(card);
        if (card.rank() == 12) direction = -direction;

        if (hand.isEmpty()) {
            finishPlayer(seat, nicknames.get(seat) + "님이 카드를 모두 냈습니다! " + nextRank + "위");
            if (finished) return;
            turnSeat = nextActiveSeat(seat, 1);
            return;
        }
        if (card.rank() == 13) return; // K: 한 번 더
        turnSeat = nextActiveSeat(seat, card.rank() == 11 ? 2 : 1); // J: 다음 사람을 건너뛴다
    }

    private void draw(int seat) {
        int count = attackPenalty > 0 ? attackPenalty : 1;
        if (attackPenalty > 0) announcements.add(nicknames.get(seat) + "님이 공격을 받아 " + count + "장을 받았습니다.");
        attackPenalty = 0;
        for (int index = 0; index < count; index++) {
            Integer cardId = takeFromPile();
            if (cardId == null) break;
            hands.get(seat).add(cardId);
        }
        if (hands.get(seat).size() >= BANKRUPT_SIZE) {
            bankrupt(seat);
            if (finished) return;
        }
        turnSeat = nextActiveSeat(seat, 1);
    }

    /** 받을 카드가 떨어지면 버린 카드(맨 위 한 장 빼고)를 섞어 다시 쓴다 */
    private Integer takeFromPile() {
        if (drawPile.isEmpty() && discard.size() > 1) {
            List<Integer> reused = new ArrayList<>(discard.subList(0, discard.size() - 1));
            Integer topCard = discard.get(discard.size() - 1);
            discard.clear();
            discard.add(topCard);
            Collections.shuffle(reused, random);
            drawPile.addAll(reused);
        }
        return drawPile.poll();
    }

    private void bankrupt(int seat) {
        active[seat] = false;
        ranks[seat] = nextLoserRank--;
        discard.addAll(0, hands.get(seat)); // 파산한 손은 버린 더미 아래로
        hands.get(seat).clear();
        announcements.add(nicknames.get(seat) + "님이 카드 " + BANKRUPT_SIZE + "장 이상으로 파산했습니다.");
        checkEnd();
    }

    private void finishPlayer(int seat, String message) {
        active[seat] = false;
        ranks[seat] = nextRank++;
        announcements.add(message);
        checkEnd();
    }

    /** 한 명만 남으면 그 사람이 남은 순위 중 가장 높은 순위 */
    private void checkEnd() {
        int alive = 0;
        int last = -1;
        for (int seat = 0; seat < active.length; seat++) if (active[seat]) { alive++; last = seat; }
        if (alive <= 1) {
            if (last >= 0) {
                ranks[last] = nextRank++;
                active[last] = false;
            }
            finished = true;
        }
    }

    @Override
    public void leave(int seat) {
        if (finished || !active[seat]) return;
        announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
        bankrupt(seat);
        if (!finished && turnSeat == seat) {
            attackPenalty = 0;
            turnSeat = nextActiveSeat(seat, 1);
        }
    }

    private int nextActiveSeat(int seat, int steps) {
        int current = seat;
        for (int moved = 0; moved < steps; moved++) {
            for (int tries = 0; tries < active.length; tries++) {
                current = Math.floorMod(current + direction, active.length);
                if (active[current]) break;
            }
        }
        return current;
    }

    @Override
    public boolean isFinished() {
        return finished;
    }

    @Override
    public String resultText() {
        List<String> parts = new ArrayList<>();
        for (int rank = 1; rank <= ranks.length; rank++) {
            for (int seat = 0; seat < ranks.length; seat++) if (ranks[seat] == rank) parts.add(rank + "위 " + nicknames.get(seat));
        }
        return "원카드 " + String.join(" · ", parts);
    }

    @Override
    public Object viewFor(Integer seat) {
        List<PlayingCard.View> myHand = seat == null || seat < 0 || seat >= hands.size() ? List.of()
            : hands.get(seat).stream().map(id -> deck.get(id).view()).toList();
        List<Integer> counts = hands.stream().map(List::size).toList();
        List<Boolean> activeList = new ArrayList<>();
        for (boolean isActive : active) activeList.add(isActive);
        List<Integer> rankList = java.util.Arrays.stream(ranks).boxed().toList();
        return new View(seat, myHand, counts, top().view(), currentSuit, anyCard, attackPenalty, direction,
            finished ? null : turnSeat, drawPile.size(), activeList, rankList, finished);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
