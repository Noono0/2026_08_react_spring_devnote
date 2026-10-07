package com.example.devnote.crawler.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 녹화 시작 요청: 이 주소를 열고, 사용자가 브라우저에서 하는 동작을 단계로 기록한다. */
public record CrawlerRecordingRequest(
    @NotBlank(message = "녹화를 시작할 URL을 입력해 주세요.")
    @Size(max = 2_000, message = "URL은 2,000자 이하여야 합니다.")
    String startUrl,

    CrawlerBrowserWindow browserWindow
) {
    // 간결한 생성자(compact constructor): 값이 필드에 들어가기 전에 실행된다. 창 모드를 안 보내면 WEB으로 채운다.
    public CrawlerRecordingRequest {
        browserWindow = browserWindow == null ? CrawlerBrowserWindow.WEB : browserWindow;
    }
}
