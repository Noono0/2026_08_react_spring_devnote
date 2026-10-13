package com.example.devnote.online.domain.game;

import java.util.ArrayList;
import java.util.List;

/**
 * 트럼프 카드 한 장(원카드·블랙잭·포커가 함께 쓴다).
 *
 *   suit : "S"(♠) "H"(♥) "D"(◆) "C"(♣), 조커는 "BJ"(흑백 조커) "CJ"(컬러 조커)
 *   rank : 1(A) ~ 13(K), 조커는 0
 *   code : 화면에 보내는 짧은 이름. "S1"(♠A), "H13"(♥K), "BJ", "CJ"
 */
public record PlayingCard(int id, String suit, int rank) {
    public static final List<String> SUITS = List.of("S", "H", "D", "C");

    public boolean isJoker() {
        return rank == 0;
    }

    public String code() {
        return isJoker() ? suit : suit + rank;
    }

    /** 52장(조커 포함이면 54장) 새 덱. id는 0부터 차례로 */
    public static List<PlayingCard> deck(boolean withJokers) {
        List<PlayingCard> cards = new ArrayList<>();
        for (String suit : SUITS) for (int rank = 1; rank <= 13; rank++) cards.add(new PlayingCard(cards.size(), suit, rank));
        if (withJokers) {
            cards.add(new PlayingCard(cards.size(), "BJ", 0));
            cards.add(new PlayingCard(cards.size(), "CJ", 0));
        }
        return cards;
    }

    /** 화면용: 카드 번호와 이름 */
    public record View(int id, String code) {}

    public View view() {
        return new View(id, code());
    }
}
