package com.example.devnote.online.domain.game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 포커 족보 계산. 7장(내 2장 + 공용 5장) 중 가장 좋은 5장을 고른다.
 *
 * [점수 만드는 법]
 *   점수 = 족보 등급 × 15⁵ + 비교용 숫자들(큰 것부터 15진법 자리에)
 *   예: 원페어(등급 1) K K + 9 7 4 → 1·15⁵ + 13·15⁴ + 9·15³ + 7·15² + 4·15
 *   이렇게 하나의 숫자로 만들면 "누가 더 센가"를 숫자 크기 비교 한 번으로 정할 수 있다.
 *   (A는 14로 센다. 단 A-2-3-4-5 스트레이트에서는 1로 센다)
 */
public final class PokerHands {
    private PokerHands() {}

    private static final String[] NAMES = {"하이카드", "원페어", "투페어", "트리플", "스트레이트", "플러시", "풀하우스", "포카드", "스트레이트 플러시"};

    public record Result(long score, String name) {}

    public static Result best(List<PlayingCard> cards) {
        Result best = null;
        int count = cards.size();
        // 7장에서 5장 고르기 = 2장을 빼는 경우(21가지)
        for (int skipA = 0; skipA < count; skipA++) {
            for (int skipB = skipA + 1; skipB < count; skipB++) {
                List<PlayingCard> five = new ArrayList<>();
                for (int index = 0; index < count; index++) if (index != skipA && index != skipB) five.add(cards.get(index));
                if (five.size() != 5) continue;
                Result result = evaluate5(five);
                if (best == null || result.score() > best.score()) best = result;
            }
        }
        return best == null ? evaluate5(cards) : best;
    }

    static int high(PlayingCard card) {
        return card.rank() == 1 ? 14 : card.rank();
    }

    public static Result evaluate5(List<PlayingCard> five) {
        List<Integer> ranks = five.stream().map(PokerHands::high).sorted(Comparator.reverseOrder()).toList();
        boolean flush = five.stream().map(PlayingCard::suit).distinct().count() == 1;
        int straightHigh = straightHigh(ranks);

        // 같은 숫자끼리 묶기: (장수 많은 순, 같으면 숫자 큰 순)
        Map<Integer, Integer> counts = new TreeMap<>(Comparator.reverseOrder());
        for (int rank : ranks) counts.merge(rank, 1, Integer::sum);
        List<int[]> groups = new ArrayList<>();
        counts.forEach((rank, number) -> groups.add(new int[] {number, rank}));
        groups.sort((left, right) -> left[0] != right[0] ? Integer.compare(right[0], left[0]) : Integer.compare(right[1], left[1]));
        List<Integer> byGroup = groups.stream().map(group -> group[1]).toList();

        int category;
        List<Integer> tiebreak;
        if (flush && straightHigh > 0) { category = 8; tiebreak = List.of(straightHigh); }
        else if (groups.get(0)[0] == 4) { category = 7; tiebreak = byGroup; }
        else if (groups.get(0)[0] == 3 && groups.size() == 2) { category = 6; tiebreak = byGroup; }
        else if (flush) { category = 5; tiebreak = ranks; }
        else if (straightHigh > 0) { category = 4; tiebreak = List.of(straightHigh); }
        else if (groups.get(0)[0] == 3) { category = 3; tiebreak = byGroup; }
        else if (groups.get(0)[0] == 2 && groups.get(1)[0] == 2) { category = 2; tiebreak = byGroup; }
        else if (groups.get(0)[0] == 2) { category = 1; tiebreak = byGroup; }
        else { category = 0; tiebreak = ranks; }

        long score = category;
        for (int index = 0; index < 5; index++) score = score * 15 + (index < tiebreak.size() ? tiebreak.get(index) : 0);
        String name = category == 8 && straightHigh == 14 ? "로열 플러시" : NAMES[category];
        return new Result(score, name);
    }

    /** 스트레이트면 가장 높은 숫자, 아니면 0. A-2-3-4-5는 5 */
    private static int straightHigh(List<Integer> descending) {
        List<Integer> unique = descending.stream().distinct().toList();
        if (unique.size() != 5) return 0;
        if (unique.get(0) - unique.get(4) == 4) return unique.get(0);
        if (unique.equals(List.of(14, 5, 4, 3, 2))) return 5;
        return 0;
    }
}
