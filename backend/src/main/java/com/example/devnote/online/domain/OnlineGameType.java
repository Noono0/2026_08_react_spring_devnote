package com.example.devnote.online.domain;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.List;

/**
 * 온라인 대전에서 고를 수 있는 게임 목록입니다.
 *
 * [플레이어 자리 수]
 *   minSeats ~ maxSeats 사이에서 방장이 인원 수(seatCount)를 고른다. 오목처럼 2명만 하는 게임은 2~2.
 *   방에는 이보다 많은 사람이 들어올 수 있고, 자리에 앉지 않은 사람은 관전자다(OnlineRoom.MAX_PARTICIPANTS).
 *
 * [available]
 *   true인 게임만 방을 만들거나 바꿀 수 있다. 나머지는 화면에 "준비 중"으로 보인다.
 *   새 게임을 완성하면 여기서 true로 바꾸고 OnlineRoom에 그 게임의 진행 규칙을 연결한다.
 *
 * [게임 옵션]
 *   목표 타일·난이도처럼 "판을 시작하기 전에 방장이 하나 고르는 값"이 있는 게임은 getOptions()에 고를 수 있는 값을,
 *   getDefaultOption()에 처음 값을 적는다. 옵션이 없는 게임은 빈 목록과 null이다.
 *   방(OnlineRoom)은 이 목록으로 방장이 보낸 값을 검사하고, 시작할 때 게임(OnlineGames.create)에 넘긴다.
 */
@Getter
@RequiredArgsConstructor
public enum OnlineGameType {
    OMOK("오목", 2, 2, true),
    TETRIS("테트리스 대전", 2, 6, true),
    PUYO("뿌요뿌요 대전", 2, 6, true),
    CHESS("체스", 2, 2, true),
    BATTLESHIP("배틀십", 2, 2, true),
    NUMBER_BASEBALL("숫자 야구", 2, 4, true),
    ONE_CARD("원카드", 2, 4, true),
    MAFIA("마피아", 4, 8, true),
    MEMORY_MATCH("카드 짝 맞추기 대전", 2, 4, true),
    BLACKJACK("블랙잭", 1, 4, true),
    SUTDA("섯다", 2, 4, true),
    POKER("포커", 2, 4, true),
    SUDOKU("스도쿠", 2, 4, true),
    GAME_2048("2048 대전", 2, 4, true),
    MINESWEEPER("지뢰 찾기 대전", 2, 4, true),
    /** 1명이면 혼자 연습. 종목(3쿠션·4구·8볼)은 게임 옵션으로 고른다 */
    BILLIARDS("당구", 1, 2, true),
    /** 육상 6종목. 1명이면 혼자 대회(기준 기록으로 메달). 종목은 게임 안에서 1번 선수가 고른다 */
    OLYMPIC("올림픽", 1, 4, true),
    /** 말 개수(4개·2개)는 게임 옵션으로 고른다 */
    YUTNORI("윷놀이", 2, 4, true),
    /** 그림 맞히기. 한 사람당 그리는 횟수(1~3번)는 게임 옵션으로 고른다 */
    CATCH_MIND("캐치마인드", 2, 8, true),
    /** 마·상 위치(상차림)는 게임 안에서 각자 고른다 */
    JANGGI("장기", 2, 2, true),
    /** 바둑알 튕기기. 알 수는 게임 옵션으로 고른다 */
    ALKKAGI("알까기", 2, 2, true);

    private final String label;
    private final int minSeats;
    private final int maxSeats;
    private final boolean available;

    public boolean allowsSeatCount(int seatCount) {
        return seatCount >= minSeats && seatCount <= maxSeats;
    }

    /** 게임을 바꿀 때: 지금 인원 수가 새 게임 범위 밖이면 가장 가까운 값으로 맞춘다(4인 → 오목이면 2). */
    public int clampSeatCount(int seatCount) {
        return Math.max(minSeats, Math.min(maxSeats, seatCount));
    }

    /** 방장이 고를 수 있는 옵션(화면에 보일 순서대로). 옵션이 없는 게임은 빈 목록 */
    public List<OnlineGameOption> getOptions() {
        return switch (this) {
            case SUDOKU -> List.of(
                new OnlineGameOption("EASY", "쉬움"), new OnlineGameOption("NORMAL", "보통"), new OnlineGameOption("HARD", "어려움"));
            case GAME_2048 -> List.of(
                new OnlineGameOption("256", "목표 256"), new OnlineGameOption("512", "목표 512"),
                new OnlineGameOption("1024", "목표 1024"), new OnlineGameOption("2048", "목표 2048"));
            case MINESWEEPER -> List.of(
                new OnlineGameOption("BEGINNER", "초급 · 9×9 · 지뢰 10"), new OnlineGameOption("INTERMEDIATE", "중급 · 16×16 · 지뢰 40"),
                new OnlineGameOption("EXPERT", "고급 · 16×30 · 지뢰 99"));
            case PUYO -> List.of(
                new OnlineGameOption("3", "3색"), new OnlineGameOption("4", "4색"), new OnlineGameOption("5", "5색"));
            case BILLIARDS -> List.of(
                new OnlineGameOption("THREE_CUSHION", "3쿠션"), new OnlineGameOption("FOUR_BALL", "4구"), new OnlineGameOption("EIGHT_BALL", "8볼 포켓"));
            case YUTNORI -> List.of(new OnlineGameOption("4", "말 4개"), new OnlineGameOption("2", "말 2개 · 빠른 판"));
            case ALKKAGI -> List.of(new OnlineGameOption("4", "알 4개씩"), new OnlineGameOption("6", "알 6개씩"), new OnlineGameOption("8", "알 8개씩"));
            case SUTDA -> List.of(new OnlineGameOption("TWO", "2장 섯다"), new OnlineGameOption("THREE", "3장 섯다 · 두 장 골라 보여 주기"));
            case CATCH_MIND -> List.of(
                new OnlineGameOption("1", "한 사람당 1번"), new OnlineGameOption("2", "한 사람당 2번"), new OnlineGameOption("3", "한 사람당 3번"));
            default -> List.of();
        };
    }

    /** 방을 만들거나 게임을 바꿨을 때의 처음 옵션. 옵션이 없는 게임은 null */
    public String getDefaultOption() {
        return switch (this) {
            case SUDOKU -> "NORMAL";
            case GAME_2048 -> "512";
            case MINESWEEPER -> "BEGINNER";
            case PUYO -> "4";
            case BILLIARDS -> "THREE_CUSHION";
            case YUTNORI -> "4";
            case SUTDA -> "TWO";
            case ALKKAGI -> "6";
            case CATCH_MIND -> "2";
            default -> null;
        };
    }

    public boolean allowsOption(String code) {
        return getOptions().stream().anyMatch(option -> option.code().equals(code));
    }

    /** 옵션 code → 화면 이름. 옵션이 없거나 모르는 값이면 null */
    public String optionLabel(String code) {
        return getOptions().stream().filter(option -> option.code().equals(code)).map(OnlineGameOption::label).findFirst().orElse(null);
    }
}
