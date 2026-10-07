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
import com.example.devnote.crawler.dto.CrawlerBrowserStatusResponse;
import com.example.devnote.crawler.service.CrawlerBrowserSettings;
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

/**
 * 웹 크롤러 도구 API입니다. (/api/v1/utilities/crawler)
 *
 * [기능 묶음]
 *   실행        : /run — 화면에서 만든 설정으로 바로 한 번 실행(이력 없음)
 *   실시간 화면  : /live-view — 실행 중 브라우저 화면·진행 단계 조회, 수동 조작(로그인 보조 등)
 *   녹화        : /recording — 사용자가 브라우저에서 클릭한 동작을 단계(steps)로 기록
 *   저장된 설정  : /configurations — 설정 저장·수정·삭제, 저장된 설정으로 실행(이력 남김)
 *   실행 이력    : /histories — 실행 결과·실패 원인 조회·삭제
 *   네이버 세션  : /sessions/naver — 저장된 로그인 세션 상태 확인·삭제
 *   브라우저 상태 : /browser-status — 실행 위치(local/remote)와 원격 브라우저 연결 여부
 *
 * ★ 모든 API는 슈퍼관리자만 쓸 수 있다. 검사는 메서드마다 넣지 않고 CrawlerAccessInterceptor가 경로 전체에 한 번에 건다.
 *   (새 API를 추가하면서 권한 검사를 빼먹는 실수가 생기지 않게)
 * 자세한 사용법은 docs/crawler.md 참고.
 */
@RestController
@RequestMapping("/api/v1/utilities/crawler")
@RequiredArgsConstructor
public class CrawlerController {
    private final CrawlerService crawlerService;
    private final CrawlerSessionStore crawlerSessionStore;
    private final CrawlerConfigurationService crawlerConfigurationService;
    private final CrawlerLiveViewStore crawlerLiveViewStore;
    private final CrawlerBrowserSettings crawlerBrowserSettings;

    // 화면이 실행 버튼을 켜거나 끄기 전에 묻는다. remote 모드면 원격 Chrome에 2초 안에 닿는지 확인한다.
    @GetMapping("/browser-status")
    public ApiResponse<CrawlerBrowserStatusResponse> browserStatus() {
        return ApiResponse.success(crawlerBrowserSettings.checkStatus());
    }

    // 실행이 끝날 때까지(최대 수십 초) 응답을 기다리는 동기 방식이다. 진행 상황은 다른 요청(/live-view)으로 따로 확인한다.
    @PostMapping("/run")
    public ApiResponse<CrawlerRunResponse> run(@Valid @RequestBody CrawlerRunRequest request) {
        return ApiResponse.success(crawlerService.run(request));
    }

    @GetMapping("/live-view")
    public ApiResponse<CrawlerLiveViewResponse> liveView() {
        return ApiResponse.success(crawlerLiveViewStore.get());
    }

    // 실행 중인 브라우저에 보낼 수동 동작(클릭·입력 등)을 대기열에 넣는다. 크롤러가 다음 확인 시점에 꺼내 실행한다.
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

    // 저장된 설정으로 실행: 실행 전 이력(RUNNING)을 만들고, 끝나면 성공·실패로 갱신한다.
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
