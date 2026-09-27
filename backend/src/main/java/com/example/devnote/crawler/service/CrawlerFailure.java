package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

public class CrawlerFailure extends BusinessException {
    private final String stage;
    private final String action;
    private final long elapsedMillis;
    /** Playwright·Java가 남긴 원본 오류 메시지. 사용자가 실패 원인을 그대로 확인할 수 있도록 응답에 포함한다. */
    private final String technicalMessage;

    public CrawlerFailure(ErrorCode code, String reason, String stage, String action, long elapsedMillis) {
        this(code, reason, stage, action, elapsedMillis, "");
    }

    public CrawlerFailure(
        ErrorCode code, String reason, String stage, String action, long elapsedMillis, String technicalMessage
    ) {
        super(code, reason);
        this.stage = stage;
        this.action = action;
        this.elapsedMillis = elapsedMillis;
        this.technicalMessage = technicalMessage == null ? "" : technicalMessage;
    }

    public String getStage() { return stage; }
    public String getAction() { return action; }
    public long getElapsedMillis() { return elapsedMillis; }
    public String getTechnicalMessage() { return technicalMessage; }
}
