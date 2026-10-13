package com.example.devnote.online.dto;

/** 채팅 한 줄(화면용). nickname은 안내 문구(system)면 null */
public record OnlineChatView(long chatId, String nickname, String text, long sentAt, boolean system, boolean spectator) {}
