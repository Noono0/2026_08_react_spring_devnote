package com.example.devnote.online.dto;

/** 화면에 보여 줄 참가자. 회원 번호·연결 번호는 보내지 않고 "회원인가"만 알린다. */
public record OnlineParticipantView(String participantId, String nickname, boolean member, Integer seatIndex) {}
