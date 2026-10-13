package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * 카드 짝 맞추기 대전(2~4명). 한 판의 카드를 함께 쓰고, 돌아가며 두 장씩 뒤집는다.
 *
 * [규칙]
 *   1. 카드 수: 2명 8쌍, 3명 10쌍, 4명 12쌍. 섞어서 뒷면으로 놓는다.
 *   2. 내 차례에 두 장을 뒤집는다. 같은 그림이면 내 짝(+1점)이 되고 한 번 더 한다. 다르면 차례가 넘어간다.
 *   3. 틀린 두 장은 다음 사람이 첫 장을 뒤집을 때까지 앞면으로 남는다(모두 기억할 시간). 그래서 서버 타이머가 필요 없다.
 *   4. 모든 짝이 맞춰지면 가장 많이 맞힌 사람이 이긴다(같으면 공동 승리). 나간 사람은 빠지고, 혼자 남으면 그 사람이 이긴다.
 *
 * [숨긴 정보] 뒷면인 카드의 그림은 아무에게도 보내지 않는다(브라우저 개발자 도구로도 볼 수 없다).
 */
public class MemoryMatchGame implements OnlineGame {
    public static final List<String> SYMBOLS = List.of("🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🍍", "🥝", "🥥", "🍋", "🍉", "🫐");

    /** 카드 하나의 화면 상태. symbol은 앞면(뒤집힘·맞춤)일 때만, matchedBy는 맞춘 사람 자리 */
    public record CardView(String symbol, Integer matchedBy, boolean faceUp) {}

    public record View(Integer mySeat, int columns, List<CardView> cards, Integer turnSeat, List<Integer> scores,
                       List<Boolean> active, List<Integer> winners, boolean finished) {}

    private final List<String> nicknames;
    private final String[] cards;
    private final int[] matchedBy;
    private final int[] scores;
    private final boolean[] active;
    private final List<Integer> faceUp = new ArrayList<>();
    private final List<Integer> winners = new ArrayList<>();
    private final List<String> announcements = new ArrayList<>();
    /** 틀린 두 장이 앞면으로 남아 있음(다음 뒤집기 때 덮는다) */
    private boolean mismatchShown;
    private int turnSeat;
    private boolean finished;

    public MemoryMatchGame(List<String> nicknames, Random random) {
        this.nicknames = List.copyOf(nicknames);
        int pairs = pairsFor(nicknames.size());
        List<String> deck = new ArrayList<>();
        for (String symbol : SYMBOLS.subList(0, pairs)) {
            deck.add(symbol);
            deck.add(symbol);
        }
        Collections.shuffle(deck, random);
        this.cards = deck.toArray(String[]::new);
        this.matchedBy = new int[cards.length];
        Arrays.fill(matchedBy, -1);
        this.scores = new int[nicknames.size()];
        this.active = new boolean[nicknames.size()];
        Arrays.fill(active, true);
    }

    public static int pairsFor(int players) {
        return players <= 2 ? 8 : players == 3 ? 10 : 12;
    }

    /** 테스트용: 카드 순서를 직접 정한다 */
    void setCards(List<String> symbols) {
        for (int index = 0; index < cards.length; index++) cards[index] = symbols.get(index);
    }

    @Override
    public void act(int seat, GameAction action) {
        if (finished || seat < 0 || seat >= active.length || !active[seat]) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        if (!"FLIP".equals(action.actionName())) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        Integer card = action.number();
        if (mismatchShown) { // 지난 차례에 틀린 두 장을 덮고 시작
            faceUp.clear();
            mismatchShown = false;
        }
        if (card == null || card < 0 || card >= cards.length || matchedBy[card] >= 0 || faceUp.contains(card)) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "뒤집을 수 없는 카드입니다.");
        }
        faceUp.add(card);
        if (faceUp.size() < 2) return;

        int first = faceUp.get(0);
        if (cards[first].equals(cards[card])) {
            matchedBy[first] = seat;
            matchedBy[card] = seat;
            scores[seat]++;
            faceUp.clear();
            announcements.add(nicknames.get(seat) + "님이 " + cards[card] + " 짝을 맞혔습니다! (" + scores[seat] + "쌍)");
            if (Arrays.stream(matchedBy).allMatch(owner -> owner >= 0)) finish();
            return; // 맞히면 한 번 더
        }
        mismatchShown = true;
        turnSeat = nextActiveSeat(seat);
    }

    @Override
    public void leave(int seat) {
        if (finished || !active[seat]) return;
        active[seat] = false;
        announcements.add(nicknames.get(seat) + "님이 빠졌습니다.");
        if (countActive() <= 1) {
            for (int candidate = 0; candidate < active.length; candidate++) if (active[candidate]) winners.add(candidate);
            finished = true;
            return;
        }
        if (turnSeat == seat) {
            faceUp.clear();
            mismatchShown = false;
            turnSeat = nextActiveSeat(seat);
        }
    }

    private void finish() {
        finished = true;
        int best = -1;
        for (int seat = 0; seat < scores.length; seat++) if (active[seat]) best = Math.max(best, scores[seat]);
        for (int seat = 0; seat < scores.length; seat++) if (active[seat] && scores[seat] == best) winners.add(seat);
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
        if (winners.isEmpty()) return "카드 짝 맞추기 끝";
        List<String> names = winners.stream().map(nicknames::get).toList();
        return "카드 짝 맞추기 " + String.join(" · ", names) + (names.size() > 1 ? " 공동 승리" : " 승리") + " (" + scores[winners.get(0)] + "쌍)";
    }

    @Override
    public Object viewFor(Integer seat) {
        List<CardView> views = new ArrayList<>();
        for (int index = 0; index < cards.length; index++) {
            boolean up = faceUp.contains(index);
            boolean visible = up || matchedBy[index] >= 0 || finished;
            views.add(new CardView(visible ? cards[index] : null, matchedBy[index] >= 0 ? matchedBy[index] : null, up));
        }
        List<Integer> scoreList = Arrays.stream(scores).boxed().toList();
        List<Boolean> activeList = new ArrayList<>();
        for (boolean isActive : active) activeList.add(isActive);
        int columns = cards.length <= 16 ? 4 : cards.length <= 20 ? 5 : 6;
        return new View(seat, columns, views, finished ? null : turnSeat, scoreList, activeList, List.copyOf(winners), finished);
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }

    private int countActive() {
        int count = 0;
        for (boolean isActive : active) if (isActive) count++;
        return count;
    }

    private int nextActiveSeat(int seat) {
        for (int step = 1; step <= active.length; step++) {
            int candidate = (seat + step) % active.length;
            if (active[candidate]) return candidate;
        }
        return seat;
    }
}
