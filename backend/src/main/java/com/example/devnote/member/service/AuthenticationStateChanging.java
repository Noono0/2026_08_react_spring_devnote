package com.example.devnote.member.service;

import jakarta.servlet.http.HttpServletRequest;

/** 인증 전환 직전에 기기별 개인정보 연결을 정리한다. / Clear device bindings before an authentication transition. */
public record AuthenticationStateChanging(HttpServletRequest request) {}
