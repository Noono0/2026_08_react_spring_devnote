package com.example.devnote.crawler.dto;

import java.time.Instant;

/**
 * 실시간 화면 응답. 프론트가 실행 중 주기적으로(폴링) 요청해 브라우저 화면과 진행 상태를 그린다.
 *   active               : 지금 실행(또는 녹화) 중인지
 *   imageDataUrl         : 브라우저 화면 캡처(data:image/... 형식, 화면이 없으면 빈 값)
 *   manualActionRequired : 사람이 직접 처리해야 하는 단계(캡차 등)에서 멈췄는지 + 그 안내(manualActionMessage)
 *   runStatus / finalReason / suggestedAction: 실행 결과와 실패 원인·해 볼 일
 *   collectedCount, logs : 지금까지 수집한 개수와 실행 기록
 */
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
