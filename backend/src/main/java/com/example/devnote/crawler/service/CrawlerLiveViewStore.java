package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.crawler.dto.CrawlerLiveViewResponse;
import com.example.devnote.crawler.dto.CrawlerManualActionRequest;
import com.example.devnote.crawler.dto.CrawlerManualActionType;
import com.example.devnote.crawler.dto.CrawlerScenarioStep;
import com.example.devnote.crawler.dto.CrawlerStepStatusResponse;
import com.example.devnote.crawler.dto.CrawlerStepType;
import com.example.devnote.crawler.dto.CrawlerExecutionLog;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.ScreenshotAnimations;
import com.microsoft.playwright.options.ScreenshotType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 실행 중인 크롤러의 "실시간 화면 상태"를 보관하는 곳입니다. (서버 메모리, 한 번에 한 실행)
 *
 * [두 스레드가 함께 쓴다]
 *   브라우저 스레드: 화면 캡처·단계 진행·로그를 기록하고, 수동 조작 대기열에서 명령을 꺼낸다(pollCommand).
 *   요청 스레드    : 화면이 /live-view로 상태를 읽고(get), /live-view/actions로 명령을 넣는다(enqueue).
 * 그래서 값마다 동시 접근에 안전한 도구를 쓴다.
 *   AtomicReference·AtomicBoolean: 값 하나를 통째로 안전하게 바꾼다(updateAndGet은 이전 값을 보고 새 값을 만든다).
 *   ConcurrentLinkedQueue        : 여러 스레드가 동시에 넣고 꺼내도 되는 대기열.
 *   synchronized(recordedSteps)  : 일반 ArrayList를 한 번에 한 스레드만 만지게 잠근다.
 *
 * State는 record(불변)라서 바꿀 때마다 새 State를 만들어 교체한다. 읽는 쪽은 항상 "완성된 한 상태"만 보게 된다.
 */
@Slf4j
@Component
public class CrawlerLiveViewStore {
    /** 화면에서 보낸 수동 조작 한 건(종류, 클릭 좌표, 입력 글자). */
    public record ManualCommand(CrawlerManualActionType action, double x, double y, String text) {
    }

    /**
     * inspecting: 실행은 실패했지만 원인 확인을 위해 Chromium을 닫지 않고 열어 둔 상태.
     * 이 상태에서도 화면 갱신과 직접 조작(클릭·입력·키)을 계속 받는다.
     */
    private record State(
        boolean enabled,
        boolean active,
        String stage,
        String imageDataUrl,
        Instant updatedAt,
        boolean manualActionRequired,
        String manualActionMessage,
        String runStatus,
        String finalReason,
        String suggestedAction,
        boolean inspecting,
        boolean directWindow
    ) {
        State withImage(String stage, String imageDataUrl) {
            return new State(enabled, true, stage, imageDataUrl, Instant.now(), manualActionRequired,
                manualActionMessage, runStatus, finalReason, suggestedAction, inspecting, directWindow);
        }
    }

    // 원격으로 누를 수 있는 키를 제한한다(브라우저 단축키 등 예상치 못한 키 조합을 막기 위해).
    private static final Set<String> ALLOWED_KEYS = Set.of(
        "Enter", "Tab", "Backspace", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
    );
    private final AtomicReference<State> state = new AtomicReference<>(
        new State(false, false, "대기 중", "", Instant.now(), false, "", "IDLE", "", "", false, false)
    );
    private final ConcurrentLinkedQueue<ManualCommand> commands = new ConcurrentLinkedQueue<>();
    private final AtomicBoolean closeRequested = new AtomicBoolean(false);
    /** 단계별 실행 진행 상태. 여러 요청 스레드가 읽으므로 통째로 교체하는 방식으로 갱신한다. */
    private final AtomicReference<List<CrawlerStepStatusResponse>> stepStatuses = new AtomicReference<>(List.of());
    private final AtomicBoolean recording = new AtomicBoolean(false);
    private final AtomicBoolean pauseRequested = new AtomicBoolean(false);
    private final java.util.concurrent.atomic.AtomicInteger collectedCount = new java.util.concurrent.atomic.AtomicInteger();
    private final AtomicReference<List<CrawlerExecutionLog>> logs = new AtomicReference<>(List.of());
    private final List<CrawlerScenarioStep> recordedSteps = new ArrayList<>();

    /** 새 실행 시작: 이전 실행의 명령·로그·단계·녹화 기록을 모두 비우고 RUNNING 상태로 만든다. */
    public void begin(boolean enabled) {
        begin(enabled, false);
    }

    /**
     * directWindow: 백엔드가 사용자 PC에서 실행돼 실제 Chromium 창을 직접 조작할 수 있는 상태.
     * 이때는 웹 화면의 원격 클릭·키 입력 대신 실제 창과 Playwright Inspector를 사용한다.
     */
    public void begin(boolean enabled, boolean directWindow) {
        commands.clear();
        closeRequested.set(false);
        pauseRequested.set(false);
        collectedCount.set(0);
        logs.set(List.of());
        stepStatuses.set(List.of());
        recording.set(false);
        synchronized (recordedSteps) {
            recordedSteps.clear();
        }
        state.set(new State(
            enabled, true, enabled ? "브라우저를 시작하는 중" : "화면 표시 안 함",
            "", Instant.now(), false, "", "RUNNING", "", "", false, directWindow
        ));
    }

    /**
     * 현재 브라우저 화면을 JPEG(품질 70)로 찍어 data URL로 저장한다. 화면이 <img src>로 바로 보여 준다.
     * 화면 보기가 꺼져 있으면 캡처하지 않고 단계 이름만 갱신한다. 캡처 실패는 실행을 멈출 일이 아니라 debug 로그만 남긴다.
     */
    public void capture(Page page, String stage) {
        State current = state.get();
        if (!current.enabled()) {
            state.updateAndGet(latest -> latest.withImage(stage, latest.imageDataUrl()));
            return;
        }
        try {
            byte[] image = page.screenshot(new Page.ScreenshotOptions()
                .setType(ScreenshotType.JPEG)
                .setQuality(70)
                .setAnimations(ScreenshotAnimations.DISABLED));
            String imageDataUrl = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(image);
            state.updateAndGet(latest -> latest.withImage(stage, imageDataUrl));
        } catch (PlaywrightException exception) {
            log.debug("[CrawlerLiveView] 화면 캡처 실패 stage={}", stage);
        }
    }

    /** 사람이 직접 처리해야 하는 단계에서 멈췄다고 표시한다(WAITING_FOR_USER). 화면에 안내 문구와 조작 버튼이 나타난다. */
    public void requireManualAction(String stage, String message) {
        state.updateAndGet(current -> new State(
            current.enabled(), true, stage, current.imageDataUrl(), Instant.now(), true, message,
            "WAITING_FOR_USER", "", message, false, current.directWindow()
        ));
    }

    /** 사람이 처리를 마쳐 다시 진행한다. 남아 있던 수동 명령은 버린다. */
    public void resolveManualAction(String stage) {
        commands.clear();
        state.updateAndGet(current -> new State(
            current.enabled(), true, stage, current.imageDataUrl(), Instant.now(), false, "",
            "RUNNING", "", "", false, current.directWindow()
        ));
    }

    /**
     * 화면에서 온 수동 조작을 검사한 뒤 대기열에 넣는다. 지금 받을 수 없는 조작이면 400 오류로 알려 준다.
     *   PAUSE: 단계 실행 중에만 / 계속·다시 시도·건너뛰기·중단: 사람의 선택을 기다리는 중에만
     *   클릭·입력·키: PC 창 모드가 아니고, 수동 처리·실패 확인·녹화 중일 때만(클릭 좌표는 1280×720 화면 안)
     */
    public void enqueue(CrawlerManualActionRequest request) {
        State current = state.get();
        if (request.action() == CrawlerManualActionType.PAUSE) {
            if (stepStatuses.get().isEmpty() || !"RUNNING".equals(current.runStatus())) {
                throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "실행 중인 작업 단계에서만 일시정지할 수 있습니다.");
            }
            pauseRequested.set(true);
            return;
        }
        if (!request.action().isBrowserInput()) {
            // 계속·다시 시도·건너뛰기·중단은 PC 창 모드에서도 웹 화면 버튼으로 보낸다.
            if (!current.active() || !(current.manualActionRequired() || recording.get() || current.inspecting())) {
                throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "지금은 계속·다시 시도·건너뛰기·중단을 받을 단계가 없습니다.");
            }
            commands.add(new ManualCommand(request.action(), 0, 0, ""));
            return;
        }
        if (current.directWindow()) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "PC에 열린 Chromium 창에서 직접 클릭하고 입력해 주세요.");
        }
        if (!current.active() || !(current.manualActionRequired() || current.inspecting() || recording.get())) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "현재 사용자의 직접 조작을 받을 수 있는 크롤링 브라우저가 없습니다.");
        }
        String text = request.text() == null ? "" : request.text();
        if (request.action() == CrawlerManualActionType.CLICK) {
            if (request.x() == null || request.y() == null
                || request.x() < 0 || request.x() > 1280 || request.y() < 0 || request.y() > 720) {
                throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "브라우저 화면 안의 클릭 위치를 선택해 주세요.");
            }
            commands.add(new ManualCommand(request.action(), request.x(), request.y(), ""));
            return;
        }
        if (request.action() == CrawlerManualActionType.TYPE) {
            if (text.isBlank()) throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "입력할 글자를 작성해 주세요.");
            commands.add(new ManualCommand(request.action(), 0, 0, text));
            return;
        }
        if (!ALLOWED_KEYS.contains(text)) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "지원하지 않는 키 입력입니다.");
        }
        commands.add(new ManualCommand(request.action(), 0, 0, text));
    }

    /** 브라우저 스레드가 대기열에서 명령 하나를 꺼낸다. 없으면 null. */
    public ManualCommand pollCommand() {
        return commands.poll();
    }

    public boolean consumePauseRequest() { return pauseRequested.getAndSet(false); }

    public void collected(int count) { collectedCount.set(count); }

    /** 실행 기록을 한 줄 추가한다. 메모리를 지키려고 최근 200줄만 남긴다. */
    public void addLog(String step, String status, String message) {
        logs.updateAndGet(current -> {
            List<CrawlerExecutionLog> next = new ArrayList<>(current);
            next.add(new CrawlerExecutionLog(Instant.now(), step, status, message));
            return List.copyOf(next.subList(Math.max(0, next.size() - 200), next.size()));
        });
    }

    /** 성공으로 끝났다고 표시한다(active = false → 화면의 주기적 갱신이 멈춘다). */
    public void completeSuccess(String stage) {
        commands.clear();
        pauseRequested.set(false);
        addLog(stage, "DONE", "수집 " + collectedCount.get() + "건 · 실행 완료");
        state.updateAndGet(current -> new State(
            current.enabled(), false, stage, current.imageDataUrl(), Instant.now(), false, "",
            "SUCCESS", "크롤링을 정상적으로 완료했습니다.", "", false, current.directWindow()
        ));
    }

    /** 실패로 끝났다고 표시하고 실패 이유·해 볼 일을 남긴다. */
    public void completeFailure(String stage, String reason, String action) {
        commands.clear();
        pauseRequested.set(false);
        addLog(stage, "FAILED", reason);
        state.updateAndGet(current -> new State(
            current.enabled(), false, stage, current.imageDataUrl(), Instant.now(), false, "",
            "FAILURE", reason, action, false, current.directWindow()
        ));
    }

    /** 실패 이유는 그대로 두고, 브라우저를 닫지 않은 채 화면 갱신과 직접 조작을 계속 받는다. */
    public void holdAfterFailure() {
        commands.clear();
        state.updateAndGet(current -> new State(
            current.enabled(), true, current.stage(), current.imageDataUrl(), Instant.now(), false, "",
            "FAILURE", current.finalReason(), current.suggestedAction(), true, current.directWindow()
        ));
    }

    /** 실패 화면으로 열어 둔 브라우저에 닫기를 요청한다. 열어 둔 브라우저가 없으면 아무것도 하지 않는다. */
    public boolean requestCloseInspection() {
        if (!state.get().inspecting()) return false;
        closeRequested.set(true);
        return true;
    }

    public boolean isCloseRequested() {
        return closeRequested.get();
    }

    /** 실패 확인용으로 열어 둔 브라우저를 닫은 뒤의 상태. 닫힌 이유를 해 볼 일 뒤에 덧붙인다. */
    public void endInspection(String closeMessage) {
        commands.clear();
        state.updateAndGet(current -> new State(
            current.enabled(), false, current.stage(), current.imageDataUrl(), Instant.now(), false, "",
            "FAILURE", current.finalReason(),
            current.suggestedAction().isBlank() ? closeMessage : current.suggestedAction() + " (" + closeMessage + ")",
            false, current.directWindow()
        ));
    }

    // ── 단계별 실행 진행 상태 ─────────────────────────────────────────
    public void beginSteps(List<CrawlerScenarioStep> steps) {
        List<CrawlerStepStatusResponse> statuses = new ArrayList<>();
        for (int index = 0; index < steps.size(); index++) {
            statuses.add(new CrawlerStepStatusResponse(index, steps.get(index).label(), "PENDING", ""));
        }
        stepStatuses.set(List.copyOf(statuses));
    }

    /** 단계 하나의 상태(PENDING → RUNNING → DONE·FAILED·BLOCKED·WAITING·SKIPPED)를 바꾸고 기록에도 남긴다. */
    public void markStep(int index, String status, String detail) {
        List<CrawlerStepStatusResponse> currentSteps = stepStatuses.get();
        if (index >= 0 && index < currentSteps.size()) {
            String message = switch (status) {
                case "RUNNING" -> "단계를 실행합니다.";
                case "DONE" -> "단계를 완료했습니다.";
                case "WAITING" -> "사용자의 처리를 기다립니다.";
                default -> status;
            };
            addLog((index + 1) + ". " + currentSteps.get(index).label(), status, detail == null || detail.isBlank() ? message : detail);
        }
        stepStatuses.updateAndGet(current -> {
            if (index < 0 || index >= current.size()) return current;
            List<CrawlerStepStatusResponse> next = new ArrayList<>(current);
            CrawlerStepStatusResponse old = next.get(index);
            next.set(index, new CrawlerStepStatusResponse(index, old.label(), status, detail == null ? "" : detail));
            return List.copyOf(next);
        });
    }

    /**
     * 지금 진행 중인 단계의 설명만 바꾼다(목록 7/15, 상세글 3/15처럼 세부 진행 표시용).
     * 진행 중인 단계가 없으면 아무것도 하지 않는다.
     */
    public void updateRunningStepDetail(String detail) {
        stepStatuses.updateAndGet(current -> {
            for (int index = 0; index < current.size(); index++) {
                if (!"RUNNING".equals(current.get(index).status())) continue;
                List<CrawlerStepStatusResponse> next = new ArrayList<>(current);
                CrawlerStepStatusResponse running = next.get(index);
                next.set(index, new CrawlerStepStatusResponse(index, running.label(), "RUNNING", detail == null ? "" : detail));
                return List.copyOf(next);
            }
            return current;
        });
    }

    // ── 녹화 ──────────────────────────────────────────────────────────
    public void beginRecording(boolean directWindow) {
        begin(true, directWindow);
        recording.set(true);
        state.updateAndGet(current -> new State(
            current.enabled(), true, "녹화 중", current.imageDataUrl(), Instant.now(), false, "",
            "RECORDING", "", "", false, directWindow
        ));
    }

    public boolean isRecording() {
        return recording.get();
    }

    /** 녹화된 단계를 추가한다. 같은 입력칸에 연달아 입력하면 마지막 값만 남긴다. */
    public void addRecordedStep(CrawlerScenarioStep step) {
        synchronized (recordedSteps) {
            if (!recordedSteps.isEmpty()) {
                CrawlerScenarioStep last = recordedSteps.get(recordedSteps.size() - 1);
                boolean sameFill = step.type() == CrawlerStepType.FILL && last.type() == CrawlerStepType.FILL
                    && step.targetMode() == last.targetMode() && step.target().equals(last.target());
                if (sameFill) {
                    recordedSteps.set(recordedSteps.size() - 1, step);
                    return;
                }
            }
            if (recordedSteps.size() < 100) recordedSteps.add(step);
        }
    }

    /** 녹화된 단계의 복사본을 돌려준다(밖에서 원본 목록을 바꾸지 못하게). */
    public List<CrawlerScenarioStep> recordedSteps() {
        synchronized (recordedSteps) {
            return List.copyOf(recordedSteps);
        }
    }

    /** 녹화 종료를 요청한다. 브라우저 스레드가 다음 확인 때 녹화를 마친다. */
    public void stopRecording() {
        recording.set(false);
    }

    /** 녹화가 끝났다고 표시한다(RECORDED). 화면은 기록된 단계를 단계 목록으로 가져올 수 있다. */
    public void endRecording(String stage, String reason) {
        recording.set(false);
        commands.clear();
        state.updateAndGet(current -> new State(
            current.enabled(), false, stage, current.imageDataUrl(), Instant.now(), false, "",
            "RECORDED", reason, "", false, current.directWindow()
        ));
    }

    /** 지금 상태를 응답 모양으로 묶어 돌려준다(화면이 0.7초마다 요청). */
    public CrawlerLiveViewResponse get() {
        State current = state.get();
        return new CrawlerLiveViewResponse(
            current.active(), current.stage(), current.imageDataUrl(), current.updatedAt(),
            current.manualActionRequired(), current.manualActionMessage(),
            current.runStatus(), current.finalReason(), current.suggestedAction(), current.inspecting(),
            current.directWindow(), stepStatuses.get(), recording.get(), recordedSteps(),
            pauseRequested.get(), collectedCount.get(), logs.get()
        );
    }
}
