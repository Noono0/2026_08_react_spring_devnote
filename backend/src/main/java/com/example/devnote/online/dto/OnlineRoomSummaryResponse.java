package com.example.devnote.online.dto;

/**
 * 방 목록 한 줄(대기실 화면). 비밀번호 자체는 절대 담지 않고 "있다/없다"만 알린다.
 * gameOptionLabel: 방장이 고른 게임 옵션의 화면 이름(예: "목표 512"). 옵션이 없는 게임은 null
 */
public record OnlineRoomSummaryResponse(
    String roomId,
    String title,
    String gameType,
    String gameTypeLabel,
    String gameOptionLabel,
    int seatCount,
    long playerCount,
    int participantCount,
    int maxParticipants,
    String status,
    boolean hasPassword,
    boolean membersOnly,
    String hostNickname
) {}
