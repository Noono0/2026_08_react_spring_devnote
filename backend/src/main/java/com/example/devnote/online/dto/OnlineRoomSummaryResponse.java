package com.example.devnote.online.dto;

/** 방 목록 한 줄(대기실 화면). 비밀번호 자체는 절대 담지 않고 "있다/없다"만 알린다. */
public record OnlineRoomSummaryResponse(
    String roomId,
    String title,
    String gameType,
    String gameTypeLabel,
    int seatCount,
    long playerCount,
    int participantCount,
    int maxParticipants,
    String status,
    boolean hasPassword,
    boolean membersOnly,
    String hostNickname
) {}
