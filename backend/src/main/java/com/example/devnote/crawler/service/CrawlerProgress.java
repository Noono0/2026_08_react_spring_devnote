package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.TimeoutError;

import java.time.Duration;
import java.time.Instant;

/*
 * 크롤링 한 번의 "지금 어느 단계인가"를 기억하는 작은 기록장.
 * 엔진이 단계를 시작할 때마다 at(단계, 해 볼 일)로 갱신하고, 오류가 나면 failure(...)로
 * "이 단계에서 이런 이유로 실패했고 이걸 해 보라"는 CrawlerFailure를 만든다.
 */
/** 요청마다 생성하며 입력값이나 Playwright 원문 로그는 진단 응답에 넣지 않습니다. */
final class CrawlerProgress {
    private final Instant startedAt = Instant.now();
    private String stage = "수집 주소 확인";
    private String action = "공개 HTTP(S) 주소와 로그인 주소 설정을 확인해 주세요.";

    void at(String stage, String action) {
        this.stage = stage;
        this.action = action;
    }

    CrawlerFailure failure(BusinessException error) {
        return new CrawlerFailure(error.getErrorCode(), error.getMessage(), stage, action, elapsed());
    }

    /**
     * Playwright 오류 메시지의 특징 문구로 원인을 분류해 사람이 읽을 수 있는 설명으로 바꾼다.
     * (Chromium 미설치, DNS 실패, 인증서 오류, 네트워크 오류, 시간 초과, 선택자 문법 오류)
     * 로그인 단계에서 났으면 CRAWLER_LOGIN_FAILED, 그 외에는 CRAWLER_EXECUTION_FAILED 코드를 쓴다.
     */
    CrawlerFailure failure(PlaywrightException error) {
        String message = error.getMessage() == null ? "" : error.getMessage();
        String reason;
        if (message.contains("Executable doesn't exist") || message.contains("Host system is missing dependencies")) {
            reason = "서버의 Chromium 실행 파일 또는 실행에 필요한 라이브러리를 찾을 수 없습니다.";
        } else if (message.contains("net::ERR_NAME_NOT_RESOLVED")) {
            reason = "대상 사이트의 도메인을 IP 주소로 변환하지 못했습니다(DNS 오류).";
        } else if (message.contains("net::ERR_CERT")) {
            reason = "대상 사이트의 HTTPS 인증서를 검증하지 못했습니다.";
        } else if (message.contains("net::ERR_")) {
            reason = "대상 사이트로 이동하는 중 네트워크 연결 오류가 발생했습니다.";
        } else if (error instanceof TimeoutError) {
            reason = "이 단계의 대기 시간을 초과했습니다(페이지 이동 최대 25초, 요소 동작 최대 15초). 요소가 없거나 숨겨져 있거나 페이지 응답이 늦을 수 있습니다.";
        } else if (message.contains("Unexpected token") || message.contains("not a valid selector") || message.contains("Unknown engine")) {
            reason = "입력한 선택자의 문법을 해석하지 못했습니다.";
        } else {
            reason = "브라우저가 이 단계의 동작을 완료하지 못했습니다. 요소 변경 또는 페이지 종료 여부를 확인해 주세요.";
        }
        String waitedElement = waitedElement(message);
        if (!waitedElement.isBlank()) reason += " 기다린 요소: " + waitedElement;
        ErrorCode code = stage.startsWith("로그인") ? ErrorCode.CRAWLER_LOGIN_FAILED : ErrorCode.CRAWLER_EXECUTION_FAILED;
        return new CrawlerFailure(code, reason, stage, action, elapsed(), limit(message));
    }

    /** 예상하지 못한 오류도 현재 단계와 원본 메시지를 그대로 알려준다. */
    CrawlerFailure unexpectedFailure(RuntimeException error) {
        String technical = error.getClass().getName() + (error.getMessage() == null ? "" : ": " + error.getMessage());
        return new CrawlerFailure(
            ErrorCode.CRAWLER_EXECUTION_FAILED,
            "예상하지 못한 오류(" + error.getClass().getSimpleName() + ")로 이 단계를 완료하지 못했습니다.",
            stage, "원본 오류 메시지를 확인해 주세요.", elapsed(), limit(technical)
        );
    }

    /** 원본 메시지가 너무 길면 4,000자에서 자른다(응답·이력 저장 크기 제한). */
    private static String limit(String message) {
        return message.length() > 4_000 ? message.substring(0, 4_000) + "\n…(이하 생략)" : message;
    }

    /**
     * Playwright 호출 로그 중 '어떤 요소를 기다리다 실패했는지'만 꺼낸다.
     * 입력값이 섞일 수 있는 나머지 로그는 응답에 넣지 않는다.
     */
    static String waitedElement(String message) {
        for (String line : message.split("\\R")) {
            String trimmed = line.trim();
            int index = trimmed.indexOf("waiting for ");
            if (index >= 0) {
                String target = trimmed.substring(index + "waiting for ".length()).trim();
                return target.length() > 200 ? target.substring(0, 200) + "…" : target;
            }
        }
        return "";
    }

    private long elapsed() { return Duration.between(startedAt, Instant.now()).toMillis(); }
}
