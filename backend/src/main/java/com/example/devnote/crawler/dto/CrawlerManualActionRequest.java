package com.example.devnote.crawler.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 실시간 화면에서 보내는 수동 조작. CLICK은 x·y(1280×720 화면 기준 좌표), TYPE은 text(입력할 글자),
 * KEY는 text(Enter 같은 키 이름)를 쓴다. 계속·다시 시도·건너뛰기·중단은 action만 있으면 된다.
 */
public record CrawlerManualActionRequest(
    @NotNull(message = "수동 조작 종류를 선택해 주세요.")
    CrawlerManualActionType action,
    Double x,
    Double y,
    @Size(max = 500, message = "한 번에 입력할 글자는 500자 이하여야 합니다.")
    String text
) {
}
