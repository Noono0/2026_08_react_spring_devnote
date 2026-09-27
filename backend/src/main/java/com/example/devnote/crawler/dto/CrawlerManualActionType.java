package com.example.devnote.crawler.dto;

public enum CrawlerManualActionType {
    CLICK,
    TYPE,
    KEY,
    /** 막힌 단계·직접 처리 단계: 사람이 처리했으니 다음 단계로 계속 */
    CONTINUE,
    /** 막힌 단계: 같은 단계를 다시 시도 */
    RETRY,
    /** 막힌 단계: 이 단계를 건너뛰고 다음 단계로 */
    SKIP,
    /** 실행 또는 녹화를 중단 */
    STOP,
    PAUSE;

    /** 브라우저 화면을 직접 조작하는 입력인지(클릭·글자·키) 여부 */
    public boolean isBrowserInput() {
        return this == CLICK || this == TYPE || this == KEY;
    }
}
