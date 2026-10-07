package com.example.devnote.crawler.dto;

/**
 * 크롤러 브라우저 실행 준비 상태 (GET /api/v1/utilities/crawler/browser-status).
 *
 * @param mode                   LOCAL(이 서버에서 직접 실행) 또는 REMOTE(원격 Chrome에 연결)
 * @param ready                  지금 실행·녹화를 시작할 수 있는지. 화면은 false면 실행 버튼을 막는다.
 * @param remoteBrowserConnected REMOTE일 때 원격 Chrome 연결 여부. LOCAL이면 해당 없음(null).
 * @param message                화면에 그대로 보여 줄 한국어 안내
 */
public record CrawlerBrowserStatusResponse(
    String mode,
    boolean ready,
    Boolean remoteBrowserConnected,
    String message
) {
}
