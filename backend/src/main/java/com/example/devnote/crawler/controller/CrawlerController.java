package com.example.devnote.crawler.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.crawler.dto.CrawlerRunRequest;
import com.example.devnote.crawler.dto.CrawlerRunResponse;
import com.example.devnote.crawler.dto.CrawlerSessionStatusResponse;
import com.example.devnote.crawler.dto.CrawlerConfigurationResponse;
import com.example.devnote.crawler.dto.CrawlerConfigurationSaveRequest;
import com.example.devnote.crawler.dto.CrawlerRunHistoryDetailResponse;
import com.example.devnote.crawler.dto.CrawlerRunHistorySummaryResponse;
import com.example.devnote.crawler.dto.CrawlerTrackedRunResponse;
import com.example.devnote.crawler.dto.CrawlerLiveViewResponse;
import com.example.devnote.crawler.dto.CrawlerManualActionRequest;
import com.example.devnote.crawler.dto.CrawlerRecordingRequest;
import com.example.devnote.crawler.service.CrawlerConfigurationService;
import com.example.devnote.crawler.service.CrawlerService;
import com.example.devnote.crawler.service.CrawlerSessionStore;
import com.example.devnote.crawler.service.CrawlerLiveViewStore;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;

import java.util.List;

@RestController
@RequestMapping("/api/v1/utilities/crawler")
@RequiredArgsConstructor
public class CrawlerController {
    private final CrawlerService crawlerService;
    private final CrawlerSessionStore crawlerSessionStore;
    private final CrawlerConfigurationService crawlerConfigurationService;
    private final CrawlerLiveViewStore crawlerLiveViewStore;

    @PostMapping("/run")
    public ApiResponse<CrawlerRunResponse> run(@Valid @RequestBody CrawlerRunRequest request) {
        return ApiResponse.success(crawlerService.run(request));
    }

    @GetMapping("/live-view")
    public ApiResponse<CrawlerLiveViewResponse> liveView() {
        return ApiResponse.success(crawlerLiveViewStore.get());
    }

    @PostMapping("/live-view/actions")
    public ApiResponse<CrawlerLiveViewResponse> controlLiveView(
        @Valid @RequestBody CrawlerManualActionRequest request
    ) {
        crawlerLiveViewStore.enqueue(request);
        return ApiResponse.success(crawlerLiveViewStore.get());
    }

    /** 녹화를 시작한다. 진행 화면과 기록된 단계는 /live-view로 확인한다. */
    @PostMapping("/recording/start")
    public ApiResponse<CrawlerLiveViewResponse> startRecording(@Valid @RequestBody CrawlerRecordingRequest request) {
        crawlerService.startRecording(request);
        return ApiResponse.success(crawlerLiveViewStore.get());
    }

    /** 녹화를 멈춘다. */
    @PostMapping("/recording/stop")
    public ApiResponse<CrawlerLiveViewResponse> stopRecording() {
        crawlerService.stopRecording();
        return ApiResponse.success(crawlerLiveViewStore.get());
    }

    /** 실패 후 열어 둔 Chromium 창을 닫는다. */
    @PostMapping("/live-view/close")
    public ApiResponse<CrawlerLiveViewResponse> closeLiveView() {
        crawlerLiveViewStore.requestCloseInspection();
        return ApiResponse.success(crawlerLiveViewStore.get());
    }

    @GetMapping("/configurations")
    public ApiResponse<List<CrawlerConfigurationResponse>> configurations() {
        return ApiResponse.success(crawlerConfigurationService.getConfigurations());
    }

    @GetMapping("/configurations/{configurationId}")
    public ApiResponse<CrawlerConfigurationResponse> configuration(@PathVariable Long configurationId) {
        return ApiResponse.success(crawlerConfigurationService.getConfiguration(configurationId));
    }

    @PostMapping("/configurations")
    public ApiResponse<CrawlerConfigurationResponse> createConfiguration(@Valid @RequestBody CrawlerConfigurationSaveRequest request) {
        return ApiResponse.created(crawlerConfigurationService.create(request));
    }

    @PutMapping("/configurations/{configurationId}")
    public ApiResponse<CrawlerConfigurationResponse> updateConfiguration(
        @PathVariable Long configurationId,
        @Valid @RequestBody CrawlerConfigurationSaveRequest request
    ) {
        return ApiResponse.success(crawlerConfigurationService.update(configurationId, request));
    }

    @DeleteMapping("/configurations/{configurationId}")
    public ApiResponse<Void> deleteConfiguration(@PathVariable Long configurationId) {
        crawlerConfigurationService.delete(configurationId);
        return ApiResponse.success(null);
    }

    @PostMapping("/configurations/{configurationId}/runs")
    public ApiResponse<CrawlerTrackedRunResponse> runConfiguration(
        @PathVariable Long configurationId,
        @Valid @RequestBody CrawlerRunRequest request
    ) {
        return ApiResponse.success(crawlerConfigurationService.run(configurationId, request));
    }

    @GetMapping("/configurations/{configurationId}/histories")
    public ApiResponse<List<CrawlerRunHistorySummaryResponse>> histories(@PathVariable Long configurationId) {
        return ApiResponse.success(crawlerConfigurationService.getHistories(configurationId));
    }

    @GetMapping("/histories/{historyId}")
    public ApiResponse<CrawlerRunHistoryDetailResponse> history(@PathVariable Long historyId) {
        return ApiResponse.success(crawlerConfigurationService.getHistory(historyId));
    }

    @DeleteMapping("/histories/{historyId}")
    public ApiResponse<Void> deleteHistory(@PathVariable Long historyId) {
        crawlerConfigurationService.deleteHistory(historyId);
        return ApiResponse.success(null);
    }

    @GetMapping("/sessions/naver")
    public ApiResponse<CrawlerSessionStatusResponse> naverSessionStatus() {
        return ApiResponse.success(crawlerSessionStore.status());
    }

    @DeleteMapping("/sessions/naver")
    public ApiResponse<CrawlerSessionStatusResponse> deleteNaverSession() {
        crawlerSessionStore.deleteNaverSession();
        return ApiResponse.success(crawlerSessionStore.status());
    }
}
