package com.example.devnote.online.dto;

import com.example.devnote.online.domain.OnlineGameType;

/**
 * 방 정보 수정(UPDATE_ROOM) 내용. 비밀번호·게임 옵션 처리 방법은 OnlineRoomSettings 설명 참고.
 * seatCount가 null이면 "지금 인원 그대로", gameOption이 null이면 "지금 옵션 그대로(게임을 바꾸면 새 게임의 처음 옵션)"로 본다.
 */
public record OnlineRoomSettingsMessage(
    String title,
    OnlineGameType gameType,
    Integer seatCount,
    String newPassword,
    boolean removePassword,
    boolean membersOnly,
    String gameOption
) {}
