package com.example.devnote.online.domain.game;

import java.util.List;

/**
 * 온라인 대전 게임 하나의 공통 모양. (숫자 야구·배틀십·카드 게임 등 새 게임은 모두 이 인터페이스를 구현한다)
 *
 * [왜 공통 모양을 두나?]
 *   게임마다 방(OnlineRoom)에 메서드를 따로 붙이면 게임이 늘수록 방 코드가 끝없이 길어진다.
 *   방은 "자리 몇 번이 이런 행동을 했다"만 넘기고, 규칙 판단은 게임 클래스가 한다.
 *   화면도 메시지 하나(GAME_ACTION)로 모든 게임의 행동을 보낸다.
 *
 * [사람마다 다른 화면 — viewFor]
 *   카드 패·숫자 야구의 비밀 숫자·배틀십의 배 위치처럼 "나만 봐야 하는 정보"가 있다.
 *   서버가 받는 사람마다 viewFor(그 사람의 자리)로 화면 상태를 따로 만들어 보내므로,
 *   남의 패는 아예 브라우저로 가지 않는다(개발자 도구로도 볼 수 없다).
 *
 * ★ 구현 클래스는 thread-safe하지 않아도 된다. OnlineRoomService가 방을 잠근 뒤에만 부른다.
 */
public interface OnlineGame {
    /** 자리 seat의 플레이어가 한 행동. 규칙에 맞지 않으면 BusinessException */
    void act(int seat, GameAction action);

    /** 기권하거나 방을 나갔을 때. 남은 사람으로 계속하거나 끝낸다 */
    void leave(int seat);

    boolean isFinished();

    /** 끝났을 때의 결과 문구(예: "1위 철수 · 2위 영희") */
    String resultText();

    /** 끝났을 때 이긴 자리 번호(공동 승리면 여러 개, 무승부면 빈 목록). 랭킹 기록은 문구가 아니라 이 값을 쓴다 */
    List<Integer> winnerSeats();

    /** 이 사람에게 보여 줄 게임 상태. seat이 null이면 관전자(숨긴 정보 없이) */
    Object viewFor(Integer seat);

    /** 게임 중 이 자리가 채팅할 수 있는지. 마피아처럼 탈락한 사람이 정보를 흘리면 안 되는 게임만 막는다 */
    default boolean canChat(int seat) {
        return true;
    }

    /**
     * 이 자리의 결과가 이미 정해졌는지. 2048·지뢰 찾기 대전처럼 각자 자기 판을 끝내는 게임에서
     * 먼저 끝낸 사람이 나가거나 기권해도 결과(성공·실패)를 그대로 지키려고 쓴다. 차례대로 겨루는 게임은 늘 false
     */
    default boolean hasSettledResult(int seat) {
        return false;
    }

    /**
     * 시간이 흘렀음을 알린다(OnlineRoomService가 1초마다 부른다). 캐치마인드 제한 시간처럼
     * "아무도 행동하지 않아도 바뀌는" 게임만 구현하고, 상태가 바뀌었으면 true를 돌려준다(그때만 방 사람들에게 보낸다).
     * ★ 게임 객체는 시계를 직접 읽지 않고 now를 받는다. 그래야 테스트에서 시간을 마음대로 정할 수 있다.
     */
    default boolean tick(long nowMillis) {
        return false;
    }

    /** 지난번 이후 새로 생긴 안내 문구(채팅에 시스템 메시지로 남긴다). 꺼내면 비워진다 */
    default List<String> drainAnnouncements() {
        return List.of();
    }
}
