package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.crawler.dto.CrawlerManualActionRequest;
import com.example.devnote.crawler.dto.CrawlerManualActionType;
import com.example.devnote.crawler.dto.CrawlerScenarioStep;
import com.example.devnote.crawler.dto.CrawlerStepType;
import com.example.devnote.crawler.dto.CrawlerTargetMode;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CrawlerLiveViewStoreTest {
    @Test
    void pauseIsConsumedOnceAndResumesThroughTheSameCommandQueue() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(false);
        store.beginSteps(List.of(new CrawlerScenarioStep(CrawlerStepType.COLLECT, null, "", null, null, "", "", null)));
        store.enqueue(new CrawlerManualActionRequest(CrawlerManualActionType.PAUSE, null, null, ""));
        assertThat(store.get().pauseRequested()).isTrue();
        assertThat(store.consumePauseRequest()).isTrue();
        assertThat(store.consumePauseRequest()).isFalse();
        store.requireManualAction("일시정지", "계속");
        store.enqueue(new CrawlerManualActionRequest(CrawlerManualActionType.CONTINUE, null, null, ""));
        assertThat(store.pollCommand().action()).isEqualTo(CrawlerManualActionType.CONTINUE);
        store.resolveManualAction("재개");
        assertThat(store.get().runStatus()).isEqualTo("RUNNING");
        store.completeSuccess("완료");
        assertThatThrownBy(() -> store.enqueue(new CrawlerManualActionRequest(CrawlerManualActionType.PAUSE, null, null, "")))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void executionLogsAreBoundedAndResetWithCollectedCountForANewRun() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(true);
        for (int index = 0; index < 250; index++) store.addLog("단계", "DONE", "항목 " + index);
        store.collected(24);
        assertThat(store.get().logs()).hasSize(200);
        assertThat(store.get().logs().getFirst().message()).isEqualTo("항목 50");
        assertThat(store.get().collectedCount()).isEqualTo(24);
        store.begin(true);
        assertThat(store.get().logs()).isEmpty();
        assertThat(store.get().collectedCount()).isZero();
    }
    @Test
    void queuesManualCommandsOnlyWhileCrawlerWaitsForUser() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(true);

        assertThatThrownBy(() -> store.enqueue(
            new CrawlerManualActionRequest(CrawlerManualActionType.CLICK, 10.0, 20.0, "")
        )).isInstanceOf(BusinessException.class);

        store.requireManualAction("네이버 추가 보안 확인", "직접 확인해 주세요.");
        store.enqueue(new CrawlerManualActionRequest(CrawlerManualActionType.CLICK, 100.0, 200.0, ""));
        store.enqueue(new CrawlerManualActionRequest(CrawlerManualActionType.TYPE, null, null, "정답"));

        CrawlerLiveViewStore.ManualCommand click = store.pollCommand();
        CrawlerLiveViewStore.ManualCommand type = store.pollCommand();
        assertThat(click.action()).isEqualTo(CrawlerManualActionType.CLICK);
        assertThat(click.x()).isEqualTo(100.0);
        assertThat(type.action()).isEqualTo(CrawlerManualActionType.TYPE);
        assertThat(type.text()).isEqualTo("정답");
        assertThat(store.get().manualActionRequired()).isTrue();
        assertThat(store.get().runStatus()).isEqualTo("WAITING_FOR_USER");
    }

    @Test
    void preservesFailureReasonAndActionAfterBrowserCloses() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(true);

        store.completeFailure("네이버 추가 보안 확인", "이미지 보안 질문이 표시됐습니다.", "직접 인증해 주세요.");

        assertThat(store.get().active()).isFalse();
        assertThat(store.get().runStatus()).isEqualTo("FAILURE");
        assertThat(store.get().stage()).isEqualTo("네이버 추가 보안 확인");
        assertThat(store.get().finalReason()).contains("이미지 보안 질문");
        assertThat(store.get().suggestedAction()).contains("직접 인증");
    }

    @Test
    void keepsFailedBrowserOpenAndAcceptsManualCommandsUntilClosed() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(true);
        assertThat(store.requestCloseInspection()).isFalse();

        store.completeFailure("사이트 검색 실행", "검색 버튼을 찾지 못했습니다.", "선택자를 확인해 주세요.");
        store.holdAfterFailure();

        assertThat(store.get().inspecting()).isTrue();
        assertThat(store.get().active()).isTrue();
        assertThat(store.get().runStatus()).isEqualTo("FAILURE");
        assertThat(store.get().finalReason()).contains("검색 버튼");
        store.enqueue(new CrawlerManualActionRequest(CrawlerManualActionType.KEY, null, null, "Enter"));
        assertThat(store.pollCommand().text()).isEqualTo("Enter");

        assertThat(store.requestCloseInspection()).isTrue();
        assertThat(store.isCloseRequested()).isTrue();
        store.endInspection("브라우저를 닫았습니다.");
        assertThat(store.get().inspecting()).isFalse();
        assertThat(store.get().active()).isFalse();
        assertThat(store.get().finalReason()).contains("검색 버튼");

        store.begin(true);
        assertThat(store.isCloseRequested()).isFalse();
    }

    @Test
    void directWindowRunRejectsRemoteCommandsBecauseUserUsesRealChromiumWindow() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(true, true);
        store.requireManualAction("네이버 추가 보안 확인", "Chromium 창에서 직접 인증해 주세요.");

        assertThat(store.get().directWindow()).isTrue();
        assertThat(store.get().manualActionRequired()).isTrue();
        assertThatThrownBy(() -> store.enqueue(
            new CrawlerManualActionRequest(CrawlerManualActionType.CLICK, 10.0, 20.0, "")
        )).isInstanceOf(BusinessException.class)
            .hasMessageContaining("Chromium 창");
    }

    @Test
    void tracksStepProgressAndAcceptsControlCommandsWhileStepIsBlocked() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(true, true);
        store.beginSteps(List.of(
            new CrawlerScenarioStep(CrawlerStepType.CLICK, CrawlerTargetMode.TEXT, "로그인", null, null, "", "", null),
            new CrawlerScenarioStep(CrawlerStepType.COLLECT, null, null, null, null, null, null, null)
        ));
        store.markStep(0, "BLOCKED", "대상을 찾지 못함");
        store.requireManualAction("1/2단계", "막혔습니다");

        assertThat(store.get().steps()).hasSize(2);
        assertThat(store.get().steps().get(0).status()).isEqualTo("BLOCKED");
        assertThat(store.get().steps().get(0).label()).contains("클릭 '로그인'");
        // PC 창 모드에서도 계속·다시 시도·건너뛰기·중단은 웹 화면에서 보낼 수 있다.
        store.enqueue(new CrawlerManualActionRequest(CrawlerManualActionType.RETRY, null, null, ""));
        assertThat(store.pollCommand().action()).isEqualTo(CrawlerManualActionType.RETRY);
    }

    @Test
    void recordingKeepsOnlyLastValueForSameInputAndCanBeStopped() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.beginRecording(false);
        store.addRecordedStep(new CrawlerScenarioStep(CrawlerStepType.FILL, CrawlerTargetMode.TEXT, "검색", null, null, "L", "녹화", null));
        store.addRecordedStep(new CrawlerScenarioStep(CrawlerStepType.FILL, CrawlerTargetMode.TEXT, "검색", null, null, "LH", "녹화", null));
        store.addRecordedStep(new CrawlerScenarioStep(CrawlerStepType.PRESS, CrawlerTargetMode.TEXT, "검색", null, null, "Enter", "녹화", null));

        assertThat(store.get().recording()).isTrue();
        assertThat(store.get().recordedSteps()).extracting(CrawlerScenarioStep::value).containsExactly("LH", "Enter");
        store.stopRecording();
        assertThat(store.isRecording()).isFalse();
        store.endRecording("녹화 종료", "끝");
        assertThat(store.get().runStatus()).isEqualTo("RECORDED");
        assertThat(store.get().recordedSteps()).hasSize(2);
    }

    @Test
    void extractsOnlyWaitedElementFromPlaywrightCallLog() {
        String message = "Timeout 15000ms exceeded.\nCall log:\n  - waiting for locator(\"#topLayerQueryInput\").first()\n";
        assertThat(CrawlerProgress.waitedElement(message)).isEqualTo("locator(\"#topLayerQueryInput\").first()");
        assertThat(CrawlerProgress.waitedElement("Target closed")).isEmpty();
    }

    @Test
    void newRunClearsStepsRecordedInPreviousBrowserSession() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.beginRecording(false);
        store.addRecordedStep(new CrawlerScenarioStep(
            CrawlerStepType.FILL, CrawlerTargetMode.TEXT, "검색", null, null, "이전 입력", "녹화", null
        ));
        store.endRecording("녹화 종료", "끝");
        assertThat(store.get().recordedSteps()).hasSize(1);

        store.begin(true);

        assertThat(store.get().recording()).isFalse();
        assertThat(store.get().recordedSteps()).isEmpty();
    }

    @Test
    void rejectsCoordinatesOutsideBrowserViewport() {
        CrawlerLiveViewStore store = new CrawlerLiveViewStore();
        store.begin(true);
        store.requireManualAction("보안 확인", "직접 확인해 주세요.");

        assertThatThrownBy(() -> store.enqueue(
            new CrawlerManualActionRequest(CrawlerManualActionType.CLICK, 1300.0, 20.0, "")
        )).isInstanceOf(BusinessException.class)
            .hasMessageContaining("클릭 위치");
    }
}
