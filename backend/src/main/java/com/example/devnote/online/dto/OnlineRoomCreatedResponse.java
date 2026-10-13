package com.example.devnote.online.dto;

/**
 * 방을 만든 결과.
 * hostToken: 만든 사람만 받는 표. 방에 들어갈 때(JOIN) 함께 보내면 비밀번호 없이 들어가 방장이 된다(방이 있는 동안 유효).
 *   표 없이 방장을 정하면 "만든 사람보다 먼저 들어온 다른 사람"이 방장이 될 수 있기 때문이다.
 */
public record OnlineRoomCreatedResponse(String roomId, String hostToken) {}
