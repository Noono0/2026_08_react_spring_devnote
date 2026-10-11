package com.example.devnote.online.dto;

/** WebSocket 오류(ERROR). code는 ErrorCode의 code, message는 사용자에게 보여도 안전한 문구 */
public record OnlineErrorView(String code, String message) {}
