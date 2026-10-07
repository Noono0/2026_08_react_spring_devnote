package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/**
 * 크롤링 도중 실패를 "사람이 이해할 수 있게" 설명하는 예외입니다.
 *   reason(메시지): 무엇이 잘못됐는지   stage : 어느 단계에서(예: "로그인 완료 확인")
 *   action        : 사용자가 해 볼 일    elapsedMillis: 실패까지 걸린 시간
 * GlobalExceptionHandler가 이 값들을 오류 응답에 담아, 화면의 오류 패널(CrawlerErrorPanel)이 그대로 보여 준다.
 * BusinessException을 상속하므로 HTTP 상태는 ErrorCode가 정한다.
 */
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
