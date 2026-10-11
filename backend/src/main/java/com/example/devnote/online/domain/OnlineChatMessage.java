package com.example.devnote.online.domain;

/**
 * 채팅 한 줄. 서버 메모리에만 두고 DB에는 저장하지 않는다(방마다 최근 50개).
 *
 *   system    : true면 "OO님이 들어왔습니다" 같은 안내 문구(보낸 사람 없음)
 *   spectator : 보낸 사람이 그때 관전자였는지(화면에서 구분 표시)
 */
public record OnlineChatMessage(
    long chatId,
    String nickname,
    String text,
    long sentAt,
    boolean system,
    boolean spectator
) {}
