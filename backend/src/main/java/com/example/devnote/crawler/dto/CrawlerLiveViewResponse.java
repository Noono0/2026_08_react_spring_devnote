package com.example.devnote.crawler.dto;

import java.time.Instant;

public record CrawlerLiveViewResponse(
    boolean active,
    String stage,
    String imageDataUrl,
    Instant updatedAt,
    boolean manualActionRequired,
    String manualActionMessage,
    String runStatus,
    String finalReason,
    String suggestedAction,
    /** 실패 후 원인 확인을 위해 브라우저를 열어 둔 상태인지 여부 */
    boolean inspecting,
    /** 사용자 PC의 실제 Chromium 창을 직접 조작하는 실행인지 여부(웹 원격 조작 불필요) */
    boolean directWindow,
    /** 단계별 실행의 단계별 진행 상태(단계 실행이 아니면 빈 목록) */
    java.util.List<CrawlerStepStatusResponse> steps,
    /** 녹화 중 여부 */
    boolean recording,
    /** 녹화로 지금까지 기록된 단계 */
    java.util.List<CrawlerScenarioStep> recordedSteps,
    boolean pauseRequested,
    int collectedCount,
    java.util.List<CrawlerExecutionLog> logs
) {
}
