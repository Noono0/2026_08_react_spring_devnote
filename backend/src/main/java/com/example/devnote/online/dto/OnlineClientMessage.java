package com.example.devnote.online.dto;

import java.util.List;

/**
 * 화면 → 서버 WebSocket 메시지(JSON). type으로 무엇을 하려는지 구분하고, 필요한 칸만 채워 보낸다.
 *
 *   { "type": "JOIN", "roomId": "ab12cd34", "nickname": "철수", "password": "1234" }
 *   { "type": "SIT", "seatIndex": 1 }        { "type": "STAND" }
 *   { "type": "UPDATE_ROOM", "settings": { ... } }   (방장)
 *   { "type": "START" }                      (방장)
 *   { "type": "OMOK_PLACE", "row": 7, "col": 7 }
 *   { "type": "RESIGN" }
 *   { "type": "TETRIS_BOARD", "board": "....(200글자)", "score": 1200, "lines": 8 }   (블록이 굳을 때마다)
 *   { "type": "TETRIS_ATTACK", "cleared": 4 }   (2줄 이상 지웠을 때)
 *   { "type": "TETRIS_TOPPED_OUT" }   (더 쌓을 곳이 없을 때)
 *   { "type": "PUYO_BOARD", "board": "....(72글자)", "score": 1200, "lines": 3 }   (쌍이 굳을 때마다, lines=연쇄 합)
 *   { "type": "PUYO_ATTACK", "cleared": 4 }   (방해 뿌요 개수)
 *   { "type": "PUYO_TOPPED_OUT" }   (더 쌓을 곳이 없을 때)
 *   { "type": "GAME_ACTION", "action": "GUESS", "text": "382" }   (숫자 야구·배틀십·카드 게임 등 공통 틀 게임의 행동)
 *   { "type": "CHAT", "text": "안녕하세요" }
 *   { "type": "PING" }                       (연결 유지용. 서버는 PONG으로 답한다)
 *
 * [왜 메시지마다 클래스를 따로 만들지 않았나?]
 *   종류가 적고 칸이 겹쳐서, 한 모양으로 받고 OnlineGameWebSocketHandler의 switch에서 나누는 편이 따라 읽기 쉽다.
 *   대신 각 처리에서 필요한 칸이 비어 있는지 꼭 확인한다(Integer는 비어 있으면 null).
 */
public record OnlineClientMessage(
    String type,
    String roomId,
    String nickname,
    String password,
    String hostToken,
    Integer seatIndex,
    Integer row,
    Integer col,
    String text,
    OnlineRoomSettingsMessage settings,
    String board,
    Integer score,
    Integer lines,
    Integer cleared,
    String action,
    Integer number,
    List<Integer> numbers
) {}
