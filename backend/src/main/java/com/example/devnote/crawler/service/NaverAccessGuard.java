package com.example.devnote.crawler.service;

import java.net.URI;
import java.util.Optional;

// 계정 보호를 위해 "멈춰야 할 신호"(로그인 화면 이동, 보호조치·자동입력 방지 안내)를 보면 더 요청하지 않는다.
// final class + private 생성자: 객체를 만들지 않고 static 메서드만 쓰는 도구 클래스라는 뜻이다.
/** 네이버 수집 중 로그인·보호조치 화면으로 전환되면 추가 요청을 중단하기 위한 판별기. */
final class NaverAccessGuard {
    private NaverAccessGuard() {
    }

    /** 멈춰야 하면 그 이유를, 계속해도 되면 Optional.empty()를 돌려준다. 네이버가 아닌 주소는 검사하지 않는다. */
    static Optional<String> interruptionReason(String pageUrl, String bodyText) {
        URI uri;
        try {
            uri = URI.create(pageUrl);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(java.util.Locale.ROOT);
        if (!host.equals("naver.com") && !host.endsWith(".naver.com")) return Optional.empty();
        if (host.equals("nid.naver.com")) {
            return Optional.of("수집 도중 네이버 로그인·계정 확인 화면으로 이동했습니다. 추가 페이지 요청을 중단했습니다.");
        }
        String text = bodyText == null ? "" : bodyText.replaceAll("\\s+", " ");
        if (text.contains("보호조치 해제") || text.contains("아이디가 보호조치")
            || text.contains("비정상적인 접근이 감지") || text.contains("자동입력 방지문자")) {
            return Optional.of("네이버 보호조치 또는 접근 제한 안내가 나타났습니다. 추가 페이지 요청을 중단했습니다.");
        }
        return Optional.empty();
    }
}
