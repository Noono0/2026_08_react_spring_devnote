package com.example.devnote.online.domain;

/**
 * 방장이 방 정보를 고칠 때 보내는 값 묶음.
 *
 * 비밀번호는 세 가지 경우가 있다.
 *   removePassword = true         → 비밀번호 해제
 *   newPassword에 값이 있음        → 새 비밀번호로 바꾸기(또는 새로 걸기)
 *   둘 다 아님(null·빈 값, false) → 지금 비밀번호 그대로
 * 기존 비밀번호 원문은 서버도 모르므로 화면에 다시 보내 주지 않는다. 그래서 "그대로"가 따로 필요하다.
 */
public record OnlineRoomSettings(
    String title,
    OnlineGameType gameType,
    int seatCount,
    String newPassword,
    boolean removePassword,
    boolean membersOnly
) {}
