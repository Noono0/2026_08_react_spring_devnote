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
    public CrawlerRecordingRequest {
        browserWindow = browserWindow == null ? CrawlerBrowserWindow.WEB : browserWindow;
    }
}
