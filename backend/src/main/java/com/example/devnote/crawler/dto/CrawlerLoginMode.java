package com.example.devnote.crawler.dto;

/**
 * 로그인 방식. NONE = 로그인 없음, FORM = 아이디·비밀번호 입력칸에 직접 입력,
 * SAVED_SESSION = 미리 저장한 브라우저 로그인 세션 사용(네이버 카페 — crawlerSessionLogin 도구로 저장).
 */
public enum CrawlerLoginMode {
    NONE,
    FORM,
    SAVED_SESSION
}
