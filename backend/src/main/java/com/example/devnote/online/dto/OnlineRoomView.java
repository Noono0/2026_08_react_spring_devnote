package com.example.devnote.online.dto;

import java.util.List;

/**
 * 방 전체 상태(ROOM_STATE). 받는 사람마다 myParticipantId만 다르다("나는 누구인가").
 *
 *   gameOption   : 방장이 고른 게임 옵션 code와 화면 이름(gameOptionLabel). 옵션이 없는 게임은 둘 다 null
 *   seats        : 자리마다 앉은 participantId, 빈 자리는 null
 *   participants : 들어온 순서대로 모든 사람(seatIndex가 null이면 관전자)
 *   omok         : 오목 판(시작 전이면 null)
 *   tetris       : 테트리스 대전 상태(시작 전이면 null)
 *   puyo         : 뿌요뿌요 대전 상태(시작 전이면 null)
 *   game         : 공통 틀 게임(숫자 야구 등)의 상태. 받는 사람마다 다르다(남의 비밀은 빠져 있다). 모양은 gameType마다 다르다
 */
public record OnlineRoomView(
    String roomId,
    String title,
    String gameType,
    String gameTypeLabel,
    String gameOption,
    String gameOptionLabel,
    int seatCount,
    int maxParticipants,
    boolean hasPassword,
    boolean membersOnly,
    String status,
    String hostId,
    String myParticipantId,
    List<String> seats,
    List<OnlineParticipantView> participants,
    OmokView omok,
    TetrisBattleView tetris,
    PuyoBattleView puyo,
    Object game,
    String lastResult
) {}
