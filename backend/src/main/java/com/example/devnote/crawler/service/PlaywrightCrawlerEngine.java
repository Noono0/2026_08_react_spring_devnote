package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.crawler.dto.CrawlerFieldRequest;
import com.example.devnote.crawler.dto.CrawlerLoginMode;
import com.example.devnote.crawler.dto.CrawlerRunRequest;
import com.example.devnote.crawler.dto.CrawlerRunResponse;
import com.example.devnote.crawler.dto.CrawlerManualActionType;
import com.example.devnote.crawler.dto.CrawlerRecordingRequest;
import com.example.devnote.crawler.dto.CrawlerScenarioStep;
import com.example.devnote.crawler.dto.CrawlerStepType;
import com.example.devnote.crawler.dto.CrawlerTargetMode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Frame;
import com.example.devnote.crawler.dto.CrawlerValueSource;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.TimeoutError;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.ServiceWorkerPolicy;
import com.microsoft.playwright.options.WaitForSelectorState;
import com.microsoft.playwright.options.WaitUntilState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlaywrightCrawlerEngine implements WebCrawlerEngine {
    private static final double ELEMENT_TIMEOUT_MILLISECONDS = 15_000;
    private static final double NAVIGATION_TIMEOUT_MILLISECONDS = 25_000;
    private static final int MAX_SCANNED_ITEMS = 5_000;
    private static final Duration MANUAL_LOGIN_TIMEOUT = Duration.ofMinutes(10);
    private static final double LOGIN_BUTTON_SEARCH_MILLISECONDS = 7_000;
    private static final String LOGIN_BUTTON_TEXT = "로그인";
    /**
     * 검색 입력칸 선택자를 비워 두었거나 입력한 선택자가 화면에 보이지 않을 때 시도하는 범용 검색창 후보.
     * 위에서부터 '검색창일 가능성이 높은 순서'로 찾으며, 화면에 보이고 입력 가능한 첫 번째 요소를 사용한다.
     */
    private static final List<String> SEARCH_INPUT_CANDIDATES = List.of(
        "input[type=search]",
        "[role=searchbox]",
        "input[title*='검색']",
        "input[placeholder*='검색']",
        "input[aria-label*='검색']",
        "input[title*='search' i]",
        "input[placeholder*='search' i]",
        "input[aria-label*='search' i]",
        "input[name='q']",
        "input[name*='query' i]",
        "input[name*='keyword' i]",
        "input[name*='search' i]",
        "input[id*='search' i]",
        "input[class*='search' i]"
    );
    private static final Duration FAILED_BROWSER_HOLD = Duration.ofMinutes(10);
    /** 단계별 실행 전체 제한 시간(막힌 단계에서 사용자를 기다리는 시간 포함). */
    private static final Duration SCENARIO_TIMEOUT = Duration.ofMinutes(60);
    private static final Duration RECORDING_TIMEOUT = Duration.ofMinutes(15);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Semaphore CRAWL_SLOT = new Semaphore(1);
    /**
     * Playwright 객체는 만든 스레드에서만 사용해야 한다. 브라우저 작업을 전용 스레드 하나에서 실행하면
     * 실패 응답은 먼저 돌려주고, 같은 스레드가 실패한 브라우저를 계속 열어 둘 수 있다.
     */
    private static final ExecutorService BROWSER_THREAD = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "crawler-browser");
        thread.setDaemon(true);
        return thread;
    });

    private final CrawlerTargetPolicy targetPolicy;
    private final CrawlerItemMatcher itemMatcher;
    private final CrawlerSessionStore sessionStore;
    private final CrawlerLiveViewStore liveViewStore;

    /**
     * true: 백엔드가 사용자 PC에서 실행돼 Chromium 창이 화면에 직접 보인다(gradlew bootRun).
     * false: Docker의 Xvfb처럼 창이 보이지 않아 웹 화면의 원격 조작을 사용한다.
     */
    @Value("${CRAWLER_DIRECT_WINDOW:true}")
    private boolean directWindowAvailable;

    /** Docker 백엔드가 'PC에 새 창' 모드에서 연결할 PC Chrome의 원격 디버깅 주소(start-pc-chrome.cmd로 실행). */
    @Value("${CRAWLER_PC_BROWSER_URL:http://host.docker.internal:9222}")
    private String pcBrowserUrl;

    @Override
    public CrawlerRunResponse crawl(CrawlerRunRequest request) {
        // 이전 실행의 실패 화면이 열려 있으면 닫고 새 실행을 시작한다.
        liveViewStore.requestCloseInspection();
        if (!acquireCrawlSlot()) throw new BusinessException(ErrorCode.CRAWLER_BUSY);
        CompletableFuture<CrawlerRunResponse> result = new CompletableFuture<>();
        try {
            BROWSER_THREAD.execute(() -> runOnBrowserThread(request, result));
        } catch (RejectedExecutionException exception) {
            CRAWL_SLOT.release();
            throw exception;
        }
        try {
            return result.join();
        } catch (CompletionException exception) {
            if (exception.getCause() instanceof RuntimeException cause) throw cause;
            throw exception;
        }
    }

    private boolean acquireCrawlSlot() {
        try {
            return CRAWL_SLOT.tryAcquire(10, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private void runOnBrowserThread(CrawlerRunRequest request, CompletableFuture<CrawlerRunResponse> result) {
        Instant startedAt = Instant.now();
        Playwright playwright = null;
        Browser browser = null;
        BrowserContext context = null;
        Page page = null;
        CrawlerProgress progress = new CrawlerProgress();
        liveViewStore.begin(request.showBrowser(), request.usesPcWindow());
        try {
            URI startUri = targetPolicy.requireAllowedHttpUrl(request.startUrl());
            validateLoginOrigin(request, startUri);

            progress.at("브라우저 시작", "백엔드의 Playwright·Chromium 설치 상태와 실행 메모리를 확인해 주세요.");
            playwright = Playwright.create();
            browser = openBrowser(playwright, request.showBrowser(), request.usesPcWindow(), progress);
            Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                .setAcceptDownloads(false)
                .setServiceWorkers(ServiceWorkerPolicy.BLOCK)
                .setLocale("ko-KR");
            if (request.login().mode() == CrawlerLoginMode.SAVED_SESSION) {
                progress.at("저장된 로그인 세션 불러오기", "먼저 start-naver-crawler-login.cmd를 실행해 네이버 로그인을 완료해 주세요.");
                String storageState = sessionStore.readNaverSession().orElseThrow(() -> new BusinessException(
                    ErrorCode.CRAWLER_LOGIN_FAILED,
                    "저장된 네이버 로그인 세션이 없습니다. 최초 한 번은 로그인 세션 만들기를 실행해 주세요."
                ));
                contextOptions.setStorageState(storageState);
            }
            // 폼 로그인이라도 이전에 성공한 네이버 로그인 세션이 있으면 먼저 불러온다.
            // 매번 새 브라우저로 로그인하면 네이버가 '새 기기'로 보고 캡차를 계속 띄우기 때문이다.
            boolean reuseNaverSession = request.login().mode() == CrawlerLoginMode.FORM
                && isNaverCafeLogin(startUri, URI.create(request.login().loginUrl().trim()));
            if (reuseNaverSession || (request.usesSteps() && isNaverHost(startUri))) {
                sessionStore.readNaverSession().ifPresent(contextOptions::setStorageState);
            }
            context = browser.newContext(contextOptions);
            protectNetwork(context);

            page = context.newPage();
            page.setDefaultTimeout(ELEMENT_TIMEOUT_MILLISECONDS);
            page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MILLISECONDS);
            page.onDialog(dialog -> dialog.dismiss());
            liveViewStore.capture(page, "브라우저 시작");

            if (request.usesSteps()) {
                // 단계별 실행: 로그인·검색 설정 대신 사용자가 만든 단계를 순서대로 실행한다.
                CrawlerRunResponse response = runSteps(page, request, startUri, progress, startedAt);
                liveViewStore.completeSuccess("단계 실행 완료");
                result.complete(response);
                return;
            }

            // ─── [LEGACY-FORM] 기존 설정 방식 시작 ───────────────────────────────
            // 단계별 실행으로 완전히 옮기면 이 블록(로그인 → 사이트 검색 → 목록 수집)과
            // [LEGACY-FORM] 표시가 붙은 login(), searchWithinSite(), waitForManualLoginInDirectWindow() 등을 지우면 된다.
            if (request.login().mode() == CrawlerLoginMode.SAVED_SESSION) {
                progress.at("저장된 로그인 세션 확인", "세션이 만료됐다면 로그인 세션 만들기를 다시 실행해 주세요.");
                if (!hasNaverSession(page)) {
                    throw new BusinessException(ErrorCode.CRAWLER_LOGIN_FAILED, "저장된 네이버 로그인 세션이 만료되었거나 손상되었습니다.");
                }
            } else if (request.login().mode() == CrawlerLoginMode.FORM) {
                login(page, request, startUri, progress);
                if (isNaverCafeLogin(startUri, URI.create(request.login().loginUrl().trim()))) {
                    sessionStore.saveNaverSession(context.storageState());
                }
            }
            progress.at("수집 페이지 이동", "수집할 URL이 정상적으로 열리는지, 계정에 접근 권한이 있는지 확인해 주세요.");
            navigate(page, startUri.toString());
            liveViewStore.capture(page, "수집 페이지 이동 완료");
            targetPolicy.requireSameOrigin(startUri, page.url());
            searchWithinSite(page, startUri, request, progress);
            progress.at("목록 수집 준비", "반복 항목 선택자와 콘텐츠 iframe 설정을 확인해 주세요.");

            List<Map<String, String>> items = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            String pageTitle = page.title();
            CollectionSummary collectionSummary = collectPages(page, startUri, request, items, warnings, progress);
            if (collectionSummary.scannedItemCount() == 0) {
                // 목록에서 항목을 하나도 찾지 못하면 '성공(0건)'으로 조용히 끝내지 않고 실패로 알려,
                // 브라우저를 열어 둔 채 현재 화면과 이유를 보여준다.
                throw new BusinessException(
                    ErrorCode.CRAWLER_EXECUTION_FAILED,
                    "목록에서 반복 항목을 하나도 찾지 못했습니다. 반복 항목 선택자 '" + request.itemSelector().trim()
                        + "'" + (request.contentFrameSelector() == null || request.contentFrameSelector().isBlank()
                            ? "" : ", iframe '" + request.contentFrameSelector().trim() + "'")
                        + "와 일치하는 요소가 0개입니다. 검색 결과 화면의 구조가 다르거나, 검색 결과가 없거나, 게시판 접근 권한이 없을 수 있습니다."
                );
            }

            CrawlerRunResponse response = new CrawlerRunResponse(
                Instant.now(),
                pageTitle,
                page.url(),
                collectionSummary.crawledPageCount(),
                collectionSummary.scannedItemCount(),
                Duration.between(startedAt, Instant.now()).toMillis(),
                fieldNamesOf(request, items),
                List.copyOf(items),
                List.copyOf(warnings)
            );
            liveViewStore.completeSuccess("수집 완료");
            result.complete(response);
            // ─── [LEGACY-FORM] 기존 설정 방식 끝 ─────────────────────────────────
        } catch (BusinessException exception) {
            CrawlerFailure failure = progress.failure(exception);
            failAndKeepBrowserOpen(result, failure, failure.getStage(), failure.getMessage(), failure.getAction(), page, request);
        } catch (PlaywrightException exception) {
            CrawlerFailure failure = progress.failure(exception);
            failAndKeepBrowserOpen(result, failure, failure.getStage(), failure.getMessage(), failure.getAction(), page, request);
        } catch (RuntimeException exception) {
            log.error("[PlaywrightCrawler] 예상하지 못한 실행 오류", exception);
            CrawlerFailure failure = progress.unexpectedFailure(exception);
            failAndKeepBrowserOpen(result, failure, failure.getStage(), failure.getMessage(), failure.getAction(), page, request);
        } finally {
            if (!result.isDone()) {
                result.completeExceptionally(new IllegalStateException("크롤링 실행이 비정상적으로 종료되었습니다."));
            }
            closeQuietly(context, browser, playwright);
            CRAWL_SLOT.release();
        }
    }

    /**
     * 실패 이유를 화면 상태에 기록하고 요청에는 즉시 실패를 돌려준다.
     * '브라우저 동작 화면 보기'가 켜져 있으면 브라우저를 닫지 않고 최대 10분 동안 그대로 열어 둔다.
     */
    private void failAndKeepBrowserOpen(
        CompletableFuture<CrawlerRunResponse> result,
        RuntimeException failure,
        String stage,
        String reason,
        String action,
        Page page,
        CrawlerRunRequest request
    ) {
        String pageUrl = currentUrl(page);
        String reasonWithUrl = pageUrl.isBlank() ? reason : reason + " (실패 당시 주소: " + pageUrl + ")";
        if (page != null && !page.isClosed()) liveViewStore.capture(page, stage);
        liveViewStore.completeFailure(stage, reasonWithUrl, action);
        boolean keepOpen = request.showBrowser() && page != null && !page.isClosed();
        // 응답을 돌려주기 전에 '열어 둔 상태'로 바꿔야 화면이 이어서 갱신을 요청한다.
        if (keepOpen) liveViewStore.holdAfterFailure();
        result.completeExceptionally(failure);
        if (keepOpen) holdFailedBrowser(page, stage);
    }

    private void holdFailedBrowser(Page page, String stage) {
        Instant deadline = Instant.now().plus(FAILED_BROWSER_HOLD);
        Instant nextCapture = Instant.now();
        try {
            while (Instant.now().isBefore(deadline) && !liveViewStore.isCloseRequested() && !page.isClosed()) {
                CrawlerLiveViewStore.ManualCommand command = liveViewStore.pollCommand();
                if (command != null) {
                    if (command.action() == CrawlerManualActionType.STOP) break;
                    applyManualCommand(page, command);
                    nextCapture = Instant.now();
                }
                if (!Instant.now().isBefore(nextCapture)) {
                    liveViewStore.capture(page, stage);
                    nextCapture = Instant.now().plusMillis(700);
                }
                page.waitForTimeout(200);
            }
        } catch (PlaywrightException exception) {
            log.debug("[PlaywrightCrawler] 실패 화면 유지 중 브라우저가 종료됨");
        }
        liveViewStore.endInspection(liveViewStore.isCloseRequested()
            ? "브라우저 닫기를 눌러 Chromium을 종료했습니다."
            : "10분이 지나 Chromium을 자동으로 종료했습니다.");
    }

    private void applyManualCommand(Page page, CrawlerLiveViewStore.ManualCommand command) {
        switch (command.action()) {
            case CLICK -> page.mouse().click(command.x(), command.y());
            case TYPE -> page.keyboard().insertText(command.text());
            case KEY -> page.keyboard().press(command.text());
        }
        page.waitForTimeout(250);
    }

    private String currentUrl(Page page) {
        try {
            return page == null || page.isClosed() ? "" : page.url();
        } catch (PlaywrightException exception) {
            return "";
        }
    }

    /**
     * 브라우저 표시 방식에 맞게 브라우저를 준비한다.
     * - 화면 보기 끔: headless
     * - 웹 화면(WEB): Docker(Xvfb)에서는 headless: false, PC에서 실행 중이면 창을 띄우지 않도록 headless
     * - PC에 새 창(PC_WINDOW): PC에서 실행 중이면 Chromium 창을 직접 띄우고,
     *   Docker라면 PC에 열어 둔 Chrome(start-pc-chrome.cmd)에 원격 디버깅으로 연결한다.
     */
    private Browser openBrowser(Playwright playwright, boolean showBrowser, boolean pcWindow, CrawlerProgress progress) {
        if (pcWindow && !directWindowAvailable) {
            progress.at("PC 브라우저 연결", "PC에서 start-pc-chrome.cmd를 실행해 Chrome 창을 먼저 열어 두었는지 확인해 주세요.");
            String endpoint = pcBrowserEndpoint();
            try {
                return playwright.chromium().connectOverCDP(endpoint, new BrowserType.ConnectOverCDPOptions()
                    .setSlowMo(120)
                    .setTimeout(10_000));
            } catch (PlaywrightException exception) {
                throw new BusinessException(
                    ErrorCode.CRAWLER_EXECUTION_FAILED,
                    "PC의 Chrome(" + endpoint + ")에 연결하지 못했습니다. 프로젝트 폴더의 start-pc-chrome.cmd로 Chrome을 먼저 열어 두었는지 확인해 주세요."
                );
            }
        }
        boolean headless = !showBrowser || (!pcWindow && directWindowAvailable);
        return playwright.chromium().launch(new BrowserType.LaunchOptions()
            .setHeadless(headless)
            .setSlowMo(showBrowser ? 120 : 0)
            .setTimeout(NAVIGATION_TIMEOUT_MILLISECONDS));
    }

    /** Chrome 원격 디버깅은 localhost·IP가 아닌 Host 헤더를 거부하므로 호스트 이름을 IP 주소로 바꿔 연결한다. */
    private String pcBrowserEndpoint() {
        URI uri = URI.create(pcBrowserUrl.trim());
        try {
            String address = InetAddress.getByName(uri.getHost()).getHostAddress();
            String host = address.contains(":") ? "[" + address + "]" : address;
            return uri.getScheme() + "://" + host + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
        } catch (UnknownHostException exception) {
            throw new BusinessException(
                ErrorCode.CRAWLER_EXECUTION_FAILED,
                "PC 브라우저 주소(" + uri.getHost() + ")를 찾지 못했습니다. CRAWLER_PC_BROWSER_URL 설정을 확인해 주세요."
            );
        }
    }

    private void validateLoginOrigin(CrawlerRunRequest request, URI startUri) {
        if (request.login().mode() == CrawlerLoginMode.SAVED_SESSION) {
            targetPolicy.requireNaverCafeForSavedSession(startUri);
        } else if (request.login().mode() == CrawlerLoginMode.FORM) {
            targetPolicy.requireAllowedLoginUrl(startUri, request.login().loginUrl());
        }
    }

    private void protectNetwork(BrowserContext context) {
        context.route("**/*", route -> {
            String requestUrl = route.request().url();
            if (!targetPolicy.isHttpUrl(requestUrl)) {
                route.resume();
                return;
            }
            try {
                targetPolicy.requireAllowedHttpUrl(requestUrl);
                route.resume();
            } catch (BusinessException exception) {
                route.abort();
            }
        });
    }

    // [LEGACY-FORM] 기존 설정 방식 전용. 단계별 실행으로 옮기면 삭제한다.
    private void login(Page page, CrawlerRunRequest request, URI startUri, CrawlerProgress progress) {
        URI loginUri = targetPolicy.requireAllowedLoginUrl(startUri, request.login().loginUrl());
        progress.at("사이트 접속", "수집할 사이트 URL이 정상적으로 열리는지 확인해 주세요.");
        navigate(page, startUri.toString());
        liveViewStore.capture(page, "사이트 접속 완료");

        // 저장된 세션으로 이미 로그인된 상태(로그인 쿠키가 있고 '로그인' 버튼이 없음)면 로그인과 캡차를 건너뛴다.
        progress.at("기존 로그인 상태 확인", "저장된 로그인 세션이 만료됐다면 이번 실행에서 다시 로그인합니다.");
        if (isNaverCafeLogin(startUri, loginUri) && hasNaverSession(page)
            && findVisibleLoginButton(page, 2_000).isEmpty()) {
            liveViewStore.capture(page, "저장된 로그인 세션으로 로그인 유지됨");
            return;
        }

        // 사이트 화면에서 '로그인' 텍스트 버튼을 찾아 누르고, 찾지 못하면 로그인 URL로 직접 이동한다.
        progress.at("로그인 버튼 찾기", "사이트 화면에 '로그인' 텍스트 버튼이나 링크가 보이는지 확인해 주세요.");
        if (!openLoginFormByText(page, request.login().usernameSelector().trim())) {
            progress.at("로그인 페이지 직접 이동", "로그인 URL과 허용된 도메인을 확인해 주세요.");
            navigate(page, loginUri.toString());
        }
        liveViewStore.capture(page, "로그인 페이지 이동 완료");
        targetPolicy.requireAllowedCredentialPage(startUri, loginUri, page.url());
        {
            progress.at("로그인 아이디 입력", "아이디 입력칸 선택자가 실제 로그인 화면의 표시된 입력칸을 가리키는지 확인해 주세요.");
            page.locator(request.login().usernameSelector().trim()).first().fill(request.login().username());
            liveViewStore.capture(page, "로그인 아이디 입력 완료");
            progress.at("로그인 비밀번호 입력", "비밀번호 입력칸 선택자와 로그인 화면의 로딩 상태를 확인해 주세요.");
            page.locator(request.login().passwordSelector().trim()).first().fill(request.login().password());
            liveViewStore.capture(page, "로그인 비밀번호 입력 완료");
            progress.at("로그인 버튼 클릭", "'로그인' 텍스트 버튼 또는 로그인 버튼 선택자, 버튼 비활성화, 버튼을 덮은 팝업을 확인해 주세요.");
            findVisibleLoginButton(page, 2_000)
                .orElseGet(() -> page.locator(request.login().submitSelector().trim()).first())
                .click();
            progress.at("로그인 완료 확인", "계정정보와 로그인 완료 선택자를 확인해 주세요. 캡차·추가 인증이 필요한 경우 현재 자동 로그인으로 완료할 수 없습니다.");
            page.waitForTimeout(Math.max(1_000, request.waitAfterNavigationMillis()));
            liveViewStore.capture(page, "로그인 버튼 클릭 완료");
            if (request.login().loggedInSelector() != null && !request.login().loggedInSelector().isBlank()) {
                page.locator(request.login().loggedInSelector().trim()).first().waitFor(
                    new Locator.WaitForOptions()
                        .setState(WaitForSelectorState.VISIBLE)
                        .setTimeout(ELEMENT_TIMEOUT_MILLISECONDS)
                );
            }
            targetPolicy.requireAllowedPostLoginPage(startUri, loginUri, page.url());
            if (isNaverCafeLogin(startUri, loginUri) && !hasNaverSession(page)) {
                NaverLoginFailureAnalyzer.Diagnosis diagnosis = NaverLoginFailureAnalyzer.diagnose(
                    page.locator("body").innerText()
                );
                progress.at(diagnosis.stage(), diagnosis.action());
                if (diagnosis.manualActionRequired()) {
                    // PC에서 직접 띄운 창: page.pause()로 멈추고 Inspector의 Resume으로 이어간다.
                    // PC Chrome 연결(Docker)·웹 화면: 로그인 쿠키가 생길 때까지 기다렸다가 자동으로 이어간다.
                    boolean passed = request.usesPcWindow() && directWindowAvailable
                        ? waitForManualLoginInDirectWindow(page, diagnosis)
                        : waitForManualLogin(page, diagnosis, request.usesPcWindow());
                    if (passed) return;
                    progress.at(
                        "사용자 보안 확인 시간 초과",
                        "10분 안에 추가 인증을 완료하지 못했습니다. 다시 실행한 뒤 제한 시간 안에 화면의 인증을 완료해 주세요."
                    );
                    throw new BusinessException(
                        ErrorCode.CRAWLER_LOGIN_FAILED,
                        "사용자의 직접 확인을 10분 동안 기다렸지만 네이버 로그인 쿠키가 만들어지지 않아 실행을 종료했습니다."
                    );
                }
                throw new BusinessException(
                    ErrorCode.CRAWLER_LOGIN_FAILED,
                    diagnosis.reason()
                );
            }
        }
    }

    /**
     * 사이트 첫 화면에서 '로그인' 텍스트 버튼을 눌러 로그인 폼을 연다.
     * 로그인 폼(아이디 입력칸)이 보이면 true, 버튼이 없거나 폼이 열리지 않으면 false를 반환한다.
     */
    // [LEGACY-FORM] 기존 설정 방식 전용. 단계별 실행으로 옮기면 삭제한다.
    private boolean openLoginFormByText(Page page, String usernameSelector) {
        Locator usernameInput = page.locator(usernameSelector).first();
        if (usernameInput.isVisible()) return true;

        Optional<Locator> loginButton = findVisibleLoginButton(page, LOGIN_BUTTON_SEARCH_MILLISECONDS);
        if (loginButton.isEmpty()) return false;
        loginButton.get().click();
        try {
            // 같은 탭의 로그인 페이지 이동과 같은 화면의 로그인 팝업을 모두 아이디 입력칸으로 확인한다.
            usernameInput.waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(ELEMENT_TIMEOUT_MILLISECONDS));
            return true;
        } catch (TimeoutError exception) {
            return false;
        }
    }

    /** 화면에 보이는 '로그인' 버튼 → 링크 → 텍스트 순서로 찾는다. 정확히 '로그인'인 요소만 대상으로 한다. */
    private Optional<Locator> findVisibleLoginButton(Page page, double timeoutMilliseconds) {
        List<Locator> candidates = List.of(
            page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName(LOGIN_BUTTON_TEXT).setExact(true)),
            page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName(LOGIN_BUTTON_TEXT).setExact(true)),
            page.getByText(LOGIN_BUTTON_TEXT, new Page.GetByTextOptions().setExact(true))
        );
        Instant deadline = Instant.now().plusMillis((long) timeoutMilliseconds);
        do {
            for (Locator candidate : candidates) {
                Locator visible = candidate.filter(new Locator.FilterOptions().setVisible(true)).first();
                if (visible.count() > 0) return Optional.of(visible);
            }
            page.waitForTimeout(250);
        } while (Instant.now().isBefore(deadline));
        return Optional.empty();
    }

    /**
     * 캡차·2단계 인증 화면에서 page.pause()로 크롤링을 멈춘다.
     * 사용자는 PC에 열린 Chromium 창에서 직접 클릭·입력하고, 끝나면 Playwright Inspector의 Resume(▶)을 누른다.
     * Resume 후에도 로그인 쿠키가 없으면 다시 멈춘다.
     */
    // [LEGACY-FORM] 기존 설정 방식 전용. 단계별 실행으로 옮기면 삭제한다.
    private boolean waitForManualLoginInDirectWindow(Page page, NaverLoginFailureAnalyzer.Diagnosis diagnosis) {
        String guide = diagnosis.action()
            + " PC에 열린 Chromium 창에서 직접 클릭·입력해 인증을 마친 뒤, 함께 열린 Playwright Inspector 창의 Resume(▶) 버튼을 눌러 주세요.";
        liveViewStore.requireManualAction(diagnosis.stage(), guide);
        liveViewStore.capture(page, diagnosis.stage());
        Instant deadline = Instant.now().plus(MANUAL_LOGIN_TIMEOUT);
        while (Instant.now().isBefore(deadline)) {
            page.bringToFront();
            page.pause();
            liveViewStore.capture(page, diagnosis.stage());
            if (hasNaverSession(page)) {
                liveViewStore.resolveManualAction("수동 보안 확인 통과");
                liveViewStore.capture(page, "수동 보안 확인 통과");
                return true;
            }
            liveViewStore.requireManualAction(
                diagnosis.stage(),
                "아직 네이버 로그인이 완료되지 않았습니다. Chromium 창에서 인증을 마친 뒤 다시 Resume(▶)을 눌러 주세요."
            );
        }
        return false;
    }

    private boolean waitForManualLogin(Page page, NaverLoginFailureAnalyzer.Diagnosis diagnosis, boolean pcWindow) {
        liveViewStore.requireManualAction(diagnosis.stage(), pcWindow
            ? diagnosis.action() + " PC에 열린 Chrome 창에서 직접 인증하면 자동으로 다음 작업을 이어갑니다."
            : diagnosis.action());
        liveViewStore.capture(page, diagnosis.stage());
        Instant deadline = Instant.now().plus(MANUAL_LOGIN_TIMEOUT);
        Instant nextCapture = Instant.now();
        while (Instant.now().isBefore(deadline)) {
            CrawlerLiveViewStore.ManualCommand command = liveViewStore.pollCommand();
            if (command != null) {
                applyManualCommand(page, command);
                liveViewStore.capture(page, diagnosis.stage());
            }
            if (hasNaverSession(page)) {
                liveViewStore.resolveManualAction("수동 보안 확인 통과");
                liveViewStore.capture(page, "수동 보안 확인 통과");
                return true;
            }
            if (Instant.now().isAfter(nextCapture)) {
                liveViewStore.capture(page, diagnosis.stage());
                nextCapture = Instant.now().plusMillis(700);
            }
            page.waitForTimeout(200);
        }
        return false;
    }

    private boolean isNaverCafeLogin(URI startUri, URI loginUri) {
        return "https".equalsIgnoreCase(startUri.getScheme())
            && "cafe.naver.com".equalsIgnoreCase(startUri.getHost())
            && "https".equalsIgnoreCase(loginUri.getScheme())
            && "nid.naver.com".equalsIgnoreCase(loginUri.getHost());
    }

    private boolean hasNaverSession(Page page) {
        return page.context().cookies().stream().anyMatch(cookie ->
            "NID_AUT".equals(cookie.name) || "NID_SES".equals(cookie.name)
        );
    }

    // [LEGACY-FORM] 기존 설정 방식 전용. 단계별 실행으로 옮기면 삭제한다.
    private void searchWithinSite(Page page, URI startUri, CrawlerRunRequest request, CrawlerProgress progress) {
        if (!request.pageSearch().enabled()) return;
        {
            progress.at("사이트 검색창 찾기", "검색 입력칸 선택자를 비우면 화면에 보이는 검색창을 자동으로 찾습니다. 찾지 못하면 선택자를 직접 입력해 주세요.");
            FoundSearchInput found = findSearchInput(page, request.pageSearch().inputSelector());
            Locator input = found.locator();
            progress.at("사이트 검색어 입력", "찾은 검색창: " + found.description() + ". 다른 입력칸이면 검색 입력칸 선택자를 직접 입력해 주세요.");
            input.click();
            input.fill(request.pageSearch().keyword());
            if (!request.pageSearch().keyword().equals(input.inputValue())) {
                // 일부 사이트는 fill 대신 실제 키 입력만 인식한다.
                input.fill("");
                input.pressSequentially(request.pageSearch().keyword(), new Locator.PressSequentiallyOptions().setDelay(50));
            }
            liveViewStore.capture(page, "사이트 검색어 입력 완료 (" + found.description() + ")");
            progress.at("사이트 검색 실행", "검색 버튼 선택자를 확인해 주세요. 비워 두었다면 Enter 키로 검색하는 사이트인지 확인해 주세요.");
            if (request.pageSearch().submitSelector() == null || request.pageSearch().submitSelector().isBlank()) {
                input.press("Enter");
            } else {
                page.locator(request.pageSearch().submitSelector().trim()).first().click();
            }
            page.waitForTimeout(Math.max(1_000, request.waitAfterNavigationMillis()));
            liveViewStore.capture(page, "사이트 검색 실행 완료");
            targetPolicy.requireSameOrigin(startUri, page.url());
        }
    }

    private record FoundSearchInput(Locator locator, String description) {
    }

    /**
     * 검색창을 찾는다. 1) 사용자가 입력한 선택자가 화면에 보이면 그것을 쓰고,
     * 2) 아니면 SEARCH_INPUT_CANDIDATES를 본문 → iframe 순서로 확인해 처음 보이는 검색창을 쓴다.
     */
    private FoundSearchInput findSearchInput(Page page, String userSelector) {
        String selector = userSelector == null ? "" : userSelector.trim();
        Instant deadline = Instant.now().plusMillis(8_000);
        do {
            if (!selector.isEmpty()) {
                Optional<Locator> userInput = firstVisible(page, selector);
                if (userInput.isPresent()) return new FoundSearchInput(userInput.get(), "입력한 선택자 " + selector);
            }
            for (String candidate : SEARCH_INPUT_CANDIDATES) {
                Optional<Locator> input = firstVisible(page, candidate);
                if (input.isPresent()) {
                    return new FoundSearchInput(input.get(), "자동 탐색 " + describeInput(input.get()));
                }
            }
            page.waitForTimeout(300);
        } while (Instant.now().isBefore(deadline));
        throw new BusinessException(
            ErrorCode.CRAWLER_EXECUTION_FAILED,
            (selector.isEmpty() ? "" : "입력한 검색 입력칸 선택자 '" + selector + "'가 화면에 보이지 않았고, ")
                + "화면(본문과 iframe)에서 검색창으로 보이는 입력칸을 자동으로 찾지 못했습니다. 개발자 도구로 검색창을 검사해 검색 입력칸 선택자를 직접 입력해 주세요."
        );
    }

    /** 본문과 모든 iframe에서 선택자와 일치하면서 화면에 보이고 입력 가능한 첫 요소를 찾는다. */
    private Optional<Locator> firstVisible(Page page, String selector) {
        for (com.microsoft.playwright.Frame frame : page.frames()) {
            try {
                Locator matches = frame.locator(selector).filter(new Locator.FilterOptions().setVisible(true));
                int count = Math.min(matches.count(), 10);
                for (int index = 0; index < count; index++) {
                    Locator candidate = matches.nth(index);
                    if (candidate.isEditable()) return Optional.of(candidate);
                }
            } catch (PlaywrightException exception) {
                // 선택자 문법 오류나 사라진 iframe은 다음 후보로 넘어간다.
                log.debug("[PlaywrightCrawler] 검색창 후보 확인 실패 selector={}", selector);
            }
        }
        return Optional.empty();
    }

    /** 어떤 입력칸을 찾았는지 사람이 알아볼 수 있도록 주요 속성만 요약한다. */
    private String describeInput(Locator input) {
        Object description = input.evaluate(
            "element => ['id', 'name', 'title', 'placeholder', 'aria-label', 'class']"
                + ".map(name => [name, element.getAttribute(name)])"
                + ".filter(([, value]) => value)"
                + ".map(([name, value]) => name + '=\"' + value + '\"').join(' ')"
        );
        String text = description == null ? "" : description.toString();
        return "<input " + (text.length() > 160 ? text.substring(0, 160) + "…" : text) + ">";
    }

    private CollectionSummary collectPages(
        Page page,
        URI startUri,
        CrawlerRunRequest request,
        List<Map<String, String>> items,
        List<String> warnings,
        CrawlerProgress progress
    ) {
        int crawledPages = 0;
        int scannedItems = 0;
        boolean scanLimitReached = false;
        String previousFirstRow = null;
        // 상세글: 페이지마다 그 페이지 글의 상세글을 새 탭에서 모두 읽은 뒤 다음 페이지로 넘어간다.
        // 목록 탭은 그대로 두므로 페이지 위치를 잃지 않고, 중간에 멈춰도 앞 페이지는 상세글까지 완성돼 있다.
        Page detailPage = request.collectDetail() ? openDetailPage(page) : null;
        int[] detailFailures = {0, 0};
        try {
        for (int pageNumber = 1; pageNumber <= request.maxPages() && items.size() < request.maxItems(); pageNumber++) {
            progress.at(pageNumber + "페이지 목록 확인", "반복 항목 선택자, iframe 설정, 게시판 접근 권한을 확인해 주세요.");
            // 2페이지부터는 다음 페이지로 넘기기 전에 이미 '페이지 대기'만큼 쉬었다(politeDelay).
            if (pageNumber == 1) page.waitForTimeout(request.waitAfterNavigationMillis());
            liveViewStore.capture(page, pageNumber + "페이지 목록 확인");
            targetPolicy.requireSameOrigin(startUri, page.url());
            boolean autoList = request.itemSelector().isBlank();
            AutoList detected = autoList ? detectList(page) : null;
            Locator itemLocator = autoList
                ? (detected == null ? null : detected.rows())
                : locateContent(page, request, request.itemSelector());
            int itemCount = itemLocator == null ? 0 : itemLocator.count();
            if (itemCount == 0) {
                warnings.add(pageNumber + (autoList
                    ? "페이지에서 표나 반복 목록을 자동으로 찾지 못했습니다. 반복 항목 선택자를 직접 입력해 주세요."
                    : "페이지에서 반복 항목과 일치하는 요소가 0개입니다. 검색 결과가 비었거나 선택자·iframe 설정이 다르거나 접근 권한이 없을 수 있습니다. 키워드 조건 검사 전 단계입니다."));
                break;
            }
            String pageProgress = pageNumber + "/" + request.maxPages() + "페이지";
            liveViewStore.updateRunningStepDetail(pageProgress + " · 목록 " + itemCount + "건 확인 · 지금까지 모은 항목 " + items.size() + "건");
            String firstRow = safeInnerText(itemLocator.first());
            if (previousFirstRow != null && previousFirstRow.equals(firstRow)) {
                warnings.add((pageNumber - 1) + "페이지에서 다음 페이지로 넘어가지 않아 수집을 멈췄습니다. 마지막 페이지이거나 다음 페이지 버튼을 찾지 못했을 수 있습니다.");
                break;
            }
            previousFirstRow = firstRow;
            if (detected != null) {
                progress.at(pageNumber + "페이지 목록 확인", "자동 감지한 목록: " + detected.description() + ". 다른 목록이면 반복 항목 선택자를 직접 입력해 주세요.");
                liveViewStore.capture(page, pageNumber + "페이지 목록 자동 감지: " + detected.description());
            }

            crawledPages++;
            int firstItemOfPage = items.size();
            int scannedBeforePage = scannedItems;
            for (int itemIndex = 0; itemIndex < itemCount && items.size() < request.maxItems(); itemIndex++) {
                pauseAtCheckpoint(page);
                if (scannedItems >= MAX_SCANNED_ITEMS) {
                    scanLimitReached = true;
                    break;
                }
                liveViewStore.updateRunningStepDetail(pageProgress + " · 목록 읽는 중 " + (itemIndex + 1) + "/" + itemCount
                    + " · 지금까지 모은 항목 " + items.size() + "건");
                Map<String, String> item = request.fields().isEmpty()
                    ? autoExtractItem(itemLocator.nth(itemIndex), detected == null ? List.of() : detected.headers(), page.url(), pageNumber)
                    : extractItem(itemLocator.nth(itemIndex), request.fields(), page.url(), pageNumber, progress);
                if (request.parseListing()) item.putAll(CrawlerListingParser.parse(titleTextOf(item)));
                scannedItems++;
                if (itemMatcher.matches(item, request.collectionFilter())) items.add(item);
                liveViewStore.collected(items.size());
            }

            liveViewStore.addLog(pageProgress, "DONE", "목록 " + itemCount + "건 중 검사 " + (scannedItems - scannedBeforePage) + "건 · 누적 수집 " + items.size() + "건");

            liveViewStore.updateRunningStepDetail(pageProgress + " · 목록 " + itemCount + "건 확인 완료 · 지금까지 모은 항목 " + items.size() + "건");
            if (detailPage != null) {
                collectDetailsOfPage(detailPage, request, items.subList(firstItemOfPage, items.size()), pageProgress, detailFailures, progress);
            }

            progress.at(pageNumber + "페이지 다음 버튼 클릭", "다음 페이지 버튼 선택자와 버튼의 활성 상태를 확인해 주세요.");
            if (scanLimitReached || pageNumber >= request.maxPages() || items.size() >= request.maxItems()) break;
            politeDelay(page, request, (pageNumber + 1) + "페이지로 넘어가기 전");
            if (!moveToNextPage(page, request, request.nextPageSelector())) break;
        }
        } finally {
            closeDetailPage(detailPage);
        }
        if (detailFailures[1] > 0) {
            warnings.add("상세글 " + detailFailures[0] + "건 중 " + detailFailures[1] + "건은 가져오지 못했습니다. 상세내용 칸의 괄호 안 이유를 확인해 주세요.");
        }
        if (items.size() >= request.maxItems()) warnings.add("최대 수집 개수에 도달해 수집을 종료했습니다.");
        if (scanLimitReached) warnings.add("안전을 위한 최대 검사 개수 5,000건에 도달해 수집을 종료했습니다.");
        if (request.collectionFilter().isEnabled() && items.isEmpty() && scannedItems > 0) {
            warnings.add("키워드 수집 조건에 맞는 항목을 찾지 못했습니다.");
        }
        return new CollectionSummary(crawledPages, scannedItems);
    }

    private Map<String, String> extractItem(
        Locator item,
        List<CrawlerFieldRequest> fields,
        String pageUrl,
        int pageNumber,
        CrawlerProgress progress
    ) {
        Map<String, String> result = new LinkedHashMap<>();
        for (CrawlerFieldRequest field : fields) {
            progress.at(pageNumber + "페이지 필드 " + (result.size() + 1) + " 추출", "해당 순서 필드의 항목 내부 선택자와 HTML 속성 이름을 확인해 주세요.");
            Locator fieldLocator = field.selector() == null || field.selector().isBlank()
                ? item
                : item.locator(field.selector().trim()).first();
            String value = fieldLocator.count() == 0 ? "" : readValue(fieldLocator, field);
            result.put(field.name().trim(), normalizeText(value));
        }
        result.put("_pageUrl", pageUrl);
        result.put("_pageNumber", String.valueOf(pageNumber));
        return result;
    }

    private String readValue(Locator locator, CrawlerFieldRequest field) {
        if (field.valueSource() == CrawlerValueSource.TEXT) {
            String text = locator.textContent();
            return text == null ? "" : text;
        }
        String attributeName = field.attributeName().trim();
        if (attributeName.equalsIgnoreCase("href") || attributeName.equalsIgnoreCase("src")) {
            Object absoluteUrl = locator.evaluate(
                "(element, attributeName) => { const value = element.getAttribute(attributeName); return value ? new URL(value, document.baseURI).href : ''; }",
                attributeName
            );
            return absoluteUrl == null ? "" : absoluteUrl.toString();
        }
        String value = locator.getAttribute(attributeName);
        return value == null ? "" : value;
    }

    private boolean moveToNextPage(Page page, CrawlerRunRequest request, String nextPageSelector) {
        if (nextPageSelector == null || nextPageSelector.isBlank()) return autoMoveToNextPage(page, request);
        Locator nextButton = locateContent(page, request, nextPageSelector).first();
        if (nextButton.count() == 0 || !nextButton.isVisible()) return false;
        String disabled = nextButton.getAttribute("disabled");
        String ariaDisabled = nextButton.getAttribute("aria-disabled");
        if (disabled != null || "true".equalsIgnoreCase(ariaDisabled)) return false;
        nextButton.click();
        return true;
    }

    private Locator locateContent(Page page, CrawlerRunRequest request, String selector) {
        if (request.contentFrameSelector() == null || request.contentFrameSelector().isBlank()) {
            return page.locator(selector.trim());
        }
        // 네이버 카페는 일반 화면에서는 cafe_main iframe을 쓰지만 검색 결과에서는
        // 같은 origin의 새 전체 페이지로 전환한다. iframe이 사라진 경우 현재 페이지를 읽는다.
        if (page.locator(request.contentFrameSelector().trim()).count() == 0) {
            return page.locator(selector.trim());
        }
        return page.frameLocator(request.contentFrameSelector().trim()).locator(selector.trim());
    }

    private void navigate(Page page, String url) {
        com.microsoft.playwright.Response response = page.navigate(url, new Page.NavigateOptions()
            .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
            .setTimeout(NAVIGATION_TIMEOUT_MILLISECONDS));
        if (response != null && response.status() >= 400) {
            throw new BusinessException(ErrorCode.CRAWLER_EXECUTION_FAILED,
                "대상 사이트가 HTTP " + response.status() + " 오류를 반환했습니다. 접근 권한, URL 또는 사이트 응답 상태를 확인해 주세요.");
        }
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);
    }

    private String normalizeText(String value) {
        return value.replaceAll("\\s+", " ").trim();
    }

    private void closeQuietly(BrowserContext context, Browser browser, Playwright playwright) {
        try {
            if (context != null) context.close();
        } catch (RuntimeException ignored) {
            log.debug("[PlaywrightCrawler] 브라우저 컨텍스트 종료 실패");
        }
        try {
            if (browser != null) browser.close();
        } catch (RuntimeException ignored) {
            log.debug("[PlaywrightCrawler] 브라우저 종료 실패");
        }
        try {
            if (playwright != null) playwright.close();
        } catch (RuntimeException ignored) {
            log.debug("[PlaywrightCrawler] Playwright 종료 실패");
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 단계별 실행
    // ═══════════════════════════════════════════════════════════════════

    /**
     * 단계를 순서대로 실행한다. 단계가 막히면(대상을 못 찾음, 시간 초과 등) 실패로 끝내지 않고
     * 브라우저를 그대로 둔 채 사용자의 선택(계속·다시 시도·건너뛰기·중단)을 기다린다.
     * COLLECT 단계가 없으면 마지막에 목록 수집 단계를 자동으로 붙인다.
     */
    private CrawlerRunResponse runSteps(
        Page page, CrawlerRunRequest request, URI startUri, CrawlerProgress progress, Instant startedAt
    ) {
        List<CrawlerScenarioStep> steps = new ArrayList<>(request.steps());
        if (steps.stream().noneMatch(step -> step.type() == CrawlerStepType.COLLECT)) {
            steps.add(new CrawlerScenarioStep(CrawlerStepType.COLLECT, CrawlerTargetMode.TEXT, "", null, null, "", "자동 추가", null));
        }
        liveViewStore.beginSteps(steps);
        List<Map<String, String>> items = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int crawledPages = 0;
        int scannedItems = 0;
        String pageTitle = "";
        Instant deadline = Instant.now().plus(SCENARIO_TIMEOUT);

        for (int index = 0; index < steps.size(); index++) {
            pauseAtCheckpoint(page);
            CrawlerScenarioStep step = steps.get(index);
            String stage = (index + 1) + "/" + steps.size() + "단계 · " + step.label();
            boolean finished = false;
            while (!finished) {
                if (Instant.now().isAfter(deadline)) {
                    liveViewStore.markStep(index, "FAILED", "전체 제한 시간 60분 초과");
                    throw new BusinessException(ErrorCode.CRAWLER_EXECUTION_FAILED, "단계 실행 전체 제한 시간(60분)을 넘겨 중단했습니다.");
                }
                progress.at(stage, stepAction(step));
                liveViewStore.markStep(index, "RUNNING", "");
                liveViewStore.capture(page, stage);
                try {
                    if (step.type() == CrawlerStepType.MANUAL) {
                        liveViewStore.markStep(index, "WAITING", "사용자 처리 대기");
                        String message = (step.value().isBlank() ? "화면에서 직접 처리해 주세요(캡차·추가 인증 등)." : step.value())
                            + (step.target().isBlank() ? " 끝나면 '계속'을 눌러 주세요." : " '" + step.target() + "'이(가) 화면에 보이면 자동으로 계속합니다. 직접 '계속'을 눌러도 됩니다.");
                        CrawlerManualActionType decision = waitForUserDecision(page, stage, message, step.target().isBlank() ? null : step);
                        if (decision == CrawlerManualActionType.SKIP) {
                            liveViewStore.markStep(index, "SKIPPED", "사용자가 건너뜀");
                            finished = true;
                            continue;
                        }
                        if (decision == null || decision == CrawlerManualActionType.STOP) {
                            liveViewStore.markStep(index, "FAILED", decision == null ? "10분 동안 응답이 없어 중단" : "사용자가 중단");
                            throw new BusinessException(ErrorCode.CRAWLER_EXECUTION_FAILED,
                                decision == null ? "직접 처리 단계에서 10분 동안 '계속'을 누르지 않아 중단했습니다." : "사용자가 실행을 중단했습니다.");
                        }
                    } else if (step.type() == CrawlerStepType.COLLECT) {
                        URI origin = targetPolicy.requireAllowedHttpUrl(page.url());
                        CrawlerRunRequest collectionRequest = request.forCollectionStep(step);
                        CollectionSummary summary = collectPages(page, origin, collectionRequest, items, warnings, progress);
                        if (summary.scannedItemCount() == 0) {
                            if (collectionRequest.itemSelector().isBlank()) {
                                throw new StepBlockedException("현재 화면(본문과 iframe)에서 3행 이상인 표나 목록을 자동으로 찾지 못했습니다. 목록이 보이는 화면으로 옮긴 뒤 '다시 시도'하거나, 수집 설정에 반복 항목 선택자를 직접 입력해 주세요.");
                            }
                            throw new StepBlockedException("반복 항목 선택자 '" + collectionRequest.itemSelector().trim() + "'"
                                + (request.contentFrameSelector() == null || request.contentFrameSelector().isBlank()
                                    ? "" : "(iframe '" + request.contentFrameSelector().trim() + "')")
                                + "와 일치하는 목록이 현재 화면에 0개입니다. 화면을 목록이 보이는 곳으로 옮긴 뒤 '다시 시도'하거나, 수집 설정의 선택자를 확인해 주세요.");
                        }
                        crawledPages += summary.crawledPageCount();
                        scannedItems += summary.scannedItemCount();
                        pageTitle = page.title();
                    } else {
                        executeStep(page, step, request);
                    }
                    liveViewStore.capture(page, stage + " 완료");
                    liveViewStore.markStep(index, "DONE", step.type() == CrawlerStepType.MANUAL ? "직접 처리 완료" : "");
                    finished = true;
                } catch (StepBlockedException | PlaywrightException exception) {
                    String reason = describeStepError(exception);
                    liveViewStore.markStep(index, "BLOCKED", reason);
                    CrawlerManualActionType decision = waitForUserDecision(page, stage,
                        "이 단계에서 막혔습니다: " + reason
                            + " 화면을 보고 직접 해결한 뒤 '계속'(직접 처리함) · '다시 시도' · '건너뛰기' · '중단' 중 하나를 눌러 주세요.", null);
                    if (decision == CrawlerManualActionType.RETRY) continue;
                    if (decision == CrawlerManualActionType.CONTINUE) {
                        liveViewStore.markStep(index, "DONE", "직접 처리함: " + reason);
                        finished = true;
                    } else if (decision == CrawlerManualActionType.SKIP) {
                        liveViewStore.markStep(index, "SKIPPED", "건너뜀: " + reason);
                        finished = true;
                    } else {
                        liveViewStore.markStep(index, "FAILED", reason);
                        throw new BusinessException(ErrorCode.CRAWLER_EXECUTION_FAILED,
                            (decision == null ? "막힌 단계에서 10분 동안 선택이 없어 중단했습니다. " : "사용자가 중단했습니다. ") + "원인: " + reason);
                    }
                }
            }
        }

        if (isNaverHost(startUri) && hasNaverSession(page)) {
            // 다음 실행에서 캡차 없이 로그인 상태를 이어가도록 세션을 저장한다.
            sessionStore.saveNaverSession(page.context().storageState());
        }
        return new CrawlerRunResponse(
            Instant.now(),
            pageTitle.isBlank() ? page.title() : pageTitle,
            page.url(),
            crawledPages,
            scannedItems,
            Duration.between(startedAt, Instant.now()).toMillis(),
            fieldNamesOf(request, items),
            List.copyOf(items),
            List.copyOf(warnings)
        );
    }

    /** 사용자가 고칠 수 있는 단계 막힘(대상 없음, 목록 0개 등). */
    private static final class StepBlockedException extends RuntimeException {
        StepBlockedException(String message) {
            super(message);
        }
    }

    private void executeStep(Page page, CrawlerScenarioStep step, CrawlerRunRequest request) {
        switch (step.type()) {
            case GOTO -> {
                URI uri;
                try {
                    uri = targetPolicy.requireAllowedHttpUrl(step.value());
                } catch (BusinessException exception) {
                    throw new StepBlockedException("이동할 주소 '" + step.value() + "'가 올바르지 않거나 허용되지 않는 주소입니다.");
                }
                navigate(page, uri.toString());
            }
            case CLICK, NEXT_PAGE -> {
                if (step.targetMode() == CrawlerTargetMode.COORDINATE) {
                    page.mouse().click(requireCoordinate(step.x(), "x"), requireCoordinate(step.y(), "y"));
                } else {
                    resolveTarget(page, step, false).click();
                }
                settleAfterAction(page, request);
            }
            case FILL -> {
                String value = substituteVariables(step.value(), request);
                if (step.targetMode() == CrawlerTargetMode.COORDINATE) {
                    page.mouse().click(requireCoordinate(step.x(), "x"), requireCoordinate(step.y(), "y"));
                    page.keyboard().press("Control+A");
                    page.keyboard().insertText(value);
                    return;
                }
                Locator input = step.target().isBlank()
                    ? findSearchInputForStep(page)
                    : resolveTarget(page, step, true);
                input.click();
                input.fill(value);
                if (!value.equals(input.inputValue())) {
                    input.fill("");
                    input.pressSequentially(value, new Locator.PressSequentiallyOptions().setDelay(50));
                }
            }
            case PRESS -> {
                String key = step.value().isBlank() ? "Enter" : step.value().trim();
                if (step.targetMode() == CrawlerTargetMode.COORDINATE && step.x() != null && step.y() != null) {
                    page.mouse().click(step.x(), step.y());
                    page.keyboard().press(key);
                } else if (step.targetMode() != CrawlerTargetMode.COORDINATE && !step.target().isBlank()) {
                    resolveTarget(page, step, false).press(key);
                } else {
                    page.keyboard().press(key);
                }
                settleAfterAction(page, request);
            }
            case WAIT -> page.waitForTimeout(parseMillis(step.value(), 1_000));
            case WAIT_FOR -> resolveTarget(page, step, false);
            case SCROLL -> {
                page.mouse().wheel(0, Double.parseDouble(step.value()));
                settleAfterAction(page, request);
            }
            case CSV -> liveViewStore.addLog("CSV 저장", "DONE", "실행 완료 후 웹 화면에서 CSV 다운로드를 요청합니다.");
            case MANUAL, COLLECT -> {
                // runSteps에서 처리한다.
            }
        }
    }

    private Locator findSearchInputForStep(Page page) {
        try {
            return findSearchInput(page, "").locator();
        } catch (BusinessException exception) {
            throw new StepBlockedException(exception.getMessage());
        }
    }

    /** Playwright 동작 중에는 끊지 않고 단계·항목 사이에서 멈춘다. */
    private void pauseAtCheckpoint(Page page) {
        if (!liveViewStore.consumePauseRequest()) return;
        liveViewStore.addLog("일시정지", "WAITING", "사용자가 일시정지했습니다.");
        CrawlerManualActionType decision = waitForUserDecision(page, "일시정지",
            "실행을 일시정지했습니다. 재개를 누르면 멈춘 위치에서 이어집니다. 10분 동안 응답이 없으면 종료합니다.", null);
        if (decision == null || decision == CrawlerManualActionType.STOP) {
            throw new BusinessException(ErrorCode.CRAWLER_EXECUTION_FAILED,
                decision == null ? "일시정지 후 10분 동안 응답이 없어 종료했습니다." : "사용자가 실행을 중단했습니다.");
        }
        liveViewStore.addLog("실행 재개", "RUNNING", "멈춘 위치에서 이어서 실행합니다.");
    }

    private double requireCoordinate(Double value, String axis) {
        if (value == null) throw new StepBlockedException("좌표 방식인데 " + axis + " 좌표가 비어 있습니다.");
        return value;
    }

    /** 클릭·키 입력 뒤 페이지 이동이나 화면 변경이 끝날 시간을 준다. */
    private void settleAfterAction(Page page, CrawlerRunRequest request) {
        try {
            page.waitForLoadState(LoadState.DOMCONTENTLOADED, new Page.WaitForLoadStateOptions().setTimeout(NAVIGATION_TIMEOUT_MILLISECONDS));
        } catch (PlaywrightException exception) {
            log.debug("[PlaywrightCrawler] 단계 후 로딩 대기 실패");
        }
        page.waitForTimeout(Math.max(300, Math.min(request.waitAfterNavigationMillis(), 3_000)));
    }

    /** {{username}}, {{password}}를 입력한 계정정보로 바꾼다. */
    private String substituteVariables(String value, CrawlerRunRequest request) {
        String username = request.login().username() == null ? "" : request.login().username();
        String password = request.login().password() == null ? "" : request.login().password();
        return value.replace("{{username}}", username).replace("{{password}}", password);
    }

    private double parseMillis(String value, double fallback) {
        try {
            return Math.max(0, Math.min(Double.parseDouble(value.trim()), 600_000));
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    /**
     * 단계의 대상을 본문과 모든 iframe에서 찾는다. 찾을 때까지 단계 대기 시간(기본 15초) 동안 다시 확인한다.
     * TEXT: 버튼·링크·글자(정확히 일치 → 포함) / 입력칸은 라벨·안내문·제목·이름으로 찾는다.
     */
    private Locator resolveTarget(Page page, CrawlerScenarioStep step, boolean forInput) {
        if (step.target().isBlank()) throw new StepBlockedException("단계의 대상(글자 또는 선택자)이 비어 있습니다.");
        double timeout = step.timeoutMillis() == null ? ELEMENT_TIMEOUT_MILLISECONDS : step.timeoutMillis();
        Instant deadline = Instant.now().plusMillis((long) timeout);
        do {
            Optional<Locator> found = findTargetNow(page, step, forInput);
            if (found.isPresent()) return found.get();
            page.waitForTimeout(250);
        } while (Instant.now().isBefore(deadline));
        String how = step.targetMode() == CrawlerTargetMode.SELECTOR ? "선택자 '" + step.target() + "'" : "글자 '" + step.target() + "'";
        throw new StepBlockedException(how + "와 일치하는 " + (forInput ? "입력칸" : "요소") + "를 "
            + Math.round(timeout / 1000) + "초 동안 화면(본문과 iframe)에서 찾지 못했습니다.");
    }

    private Optional<Locator> findTargetNow(Page page, CrawlerScenarioStep step, boolean forInput) {
        for (Frame frame : page.frames()) {
            for (Locator candidate : targetCandidates(frame, step, forInput)) {
                try {
                    Locator visible = candidate.filter(new Locator.FilterOptions().setVisible(true));
                    int count = Math.min(visible.count(), 5);
                    for (int index = 0; index < count; index++) {
                        Locator element = visible.nth(index);
                        if (!forInput || element.isEditable()) return Optional.of(element);
                    }
                } catch (PlaywrightException exception) {
                    // 선택자 문법 오류·사라진 iframe은 다음 후보로 넘어간다.
                }
            }
        }
        return Optional.empty();
    }

    private List<Locator> targetCandidates(Frame frame, CrawlerScenarioStep step, boolean forInput) {
        String target = step.target().trim();
        if (step.targetMode() == CrawlerTargetMode.SELECTOR) return List.of(frame.locator(target));
        if (forInput) {
            return List.of(
                frame.getByLabel(target),
                frame.getByPlaceholder(target),
                frame.getByTitle(target),
                frame.getByRole(AriaRole.TEXTBOX, new Frame.GetByRoleOptions().setName(target)),
                frame.getByRole(AriaRole.SEARCHBOX, new Frame.GetByRoleOptions().setName(target))
            );
        }
        return List.of(
            frame.getByRole(AriaRole.BUTTON, new Frame.GetByRoleOptions().setName(target).setExact(true)),
            frame.getByRole(AriaRole.LINK, new Frame.GetByRoleOptions().setName(target).setExact(true)),
            frame.getByText(target, new Frame.GetByTextOptions().setExact(true)),
            frame.getByRole(AriaRole.BUTTON, new Frame.GetByRoleOptions().setName(target)),
            frame.getByRole(AriaRole.LINK, new Frame.GetByRoleOptions().setName(target)),
            frame.getByText(target),
            frame.getByTitle(target),
            frame.getByAltText(target)
        );
    }

    /**
     * 사용자의 선택을 기다린다. 기다리는 동안 웹 화면의 클릭·입력·키를 브라우저에 전달하고 화면을 갱신한다.
     * autoContinueStep이 있으면 그 대상이 화면에 보이는 순간 CONTINUE로 끝낸다. 10분 동안 선택이 없으면 null.
     */
    private CrawlerManualActionType waitForUserDecision(
        Page page, String stage, String message, CrawlerScenarioStep autoContinueStep
    ) {
        liveViewStore.requireManualAction(stage, message);
        liveViewStore.capture(page, stage);
        Instant deadline = Instant.now().plus(MANUAL_LOGIN_TIMEOUT);
        Instant nextCapture = Instant.now();
        Instant nextAutoCheck = Instant.now();
        try {
            while (Instant.now().isBefore(deadline) && !page.isClosed()) {
                CrawlerLiveViewStore.ManualCommand command = liveViewStore.pollCommand();
                if (command != null) {
                    if (command.action().isBrowserInput()) {
                        applyManualCommand(page, command);
                        nextCapture = Instant.now();
                    } else {
                        liveViewStore.resolveManualAction(stage);
                        return command.action();
                    }
                }
                if (autoContinueStep != null && !Instant.now().isBefore(nextAutoCheck)) {
                    if (findTargetNow(page, autoContinueStep, false).isPresent()) {
                        liveViewStore.resolveManualAction(stage);
                        return CrawlerManualActionType.CONTINUE;
                    }
                    nextAutoCheck = Instant.now().plusMillis(1_000);
                }
                if (!Instant.now().isBefore(nextCapture)) {
                    liveViewStore.capture(page, stage);
                    nextCapture = Instant.now().plusMillis(700);
                }
                page.waitForTimeout(200);
            }
        } catch (PlaywrightException exception) {
            log.debug("[PlaywrightCrawler] 사용자 선택 대기 중 브라우저가 종료됨");
        }
        return null;
    }

    private String describeStepError(RuntimeException exception) {
        if (exception instanceof StepBlockedException) return exception.getMessage();
        String message = exception.getMessage() == null ? "" : exception.getMessage();
        String firstLine = message.lines().findFirst().orElse("").trim();
        String waited = CrawlerProgress.waitedElement(message);
        if (exception instanceof com.microsoft.playwright.TimeoutError) {
            return "시간 안에 동작을 끝내지 못했습니다(" + firstLine + ")" + (waited.isBlank() ? "" : " 기다린 요소: " + waited);
        }
        return "브라우저 동작 실패: " + firstLine + (waited.isBlank() ? "" : " 기다린 요소: " + waited);
    }

    private String stepAction(CrawlerScenarioStep step) {
        return switch (step.type()) {
            case GOTO -> "이동할 주소가 올바른지 확인해 주세요.";
            case CLICK, WAIT_FOR, NEXT_PAGE -> "대상 글자·선택자·좌표가 현재 화면의 요소와 맞는지 확인해 주세요.";
            case FILL -> "입력칸의 제목·안내문·라벨 글자나 선택자가 맞는지 확인해 주세요.";
            case PRESS -> "누를 키 이름(Enter, Tab 등)을 확인해 주세요.";
            case WAIT -> "대기 시간(ms)을 확인해 주세요.";
            case MANUAL -> "화면에서 직접 처리한 뒤 '계속'을 눌러 주세요.";
            case COLLECT -> "반복 항목 선택자와 콘텐츠 iframe 설정을 확인해 주세요.";
            case SCROLL -> "스크롤 거리(px)를 숫자로 입력해 주세요.";
            case CSV -> "CSV 저장은 목록 반복 뒤 마지막 단계에 놓아 주세요.";
        };
    }

    private boolean isNaverHost(URI uri) {
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(java.util.Locale.ROOT);
        return "https".equalsIgnoreCase(uri.getScheme()) && (host.equals("naver.com") || host.endsWith(".naver.com"));
    }

    // ═══════════════════════════════════════════════════════════════════
    // 녹화: 브라우저에서 직접 클릭·입력한 동작을 단계로 기록한다.
    // ═══════════════════════════════════════════════════════════════════

    /** 모든 페이지·iframe에 주입해 클릭·입력·Enter를 백엔드로 알려주는 스크립트. */
    private static final String RECORDER_SCRIPT = """
        (() => {
          if (window.__crawlerRecorderInstalled) return;
          window.__crawlerRecorderInstalled = true;
          const send = (event) => { if (typeof window.__crawlerRecord === 'function') window.__crawlerRecord(JSON.stringify(event)); };
          const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
          const safeId = (value) => /^[A-Za-z][\\w-]*$/.test(value || '');
          const cssPath = (element) => {
            if (safeId(element.id)) return '#' + element.id;
            const name = element.getAttribute('name');
            if (name) return element.tagName.toLowerCase() + '[name="' + name + '"]';
            const parts = [];
            let current = element;
            while (current && current.nodeType === 1 && parts.length < 5) {
              if (safeId(current.id)) { parts.unshift('#' + current.id); break; }
              let part = current.tagName.toLowerCase();
              const classes = [...current.classList].filter(safeId).slice(0, 2);
              if (classes.length) part += '.' + classes.join('.');
              const parent = current.parentElement;
              if (parent) {
                const same = [...parent.children].filter((child) => child.tagName === current.tagName);
                if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(current) + 1) + ')';
              }
              parts.unshift(part);
              current = parent;
            }
            return parts.join(' > ');
          };
          const isTextInput = (element) => element.matches('textarea, input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=image])');
          const inputLabel = (element) => clean(element.getAttribute('title') || element.getAttribute('placeholder') || element.getAttribute('aria-label')
            || (element.labels && element.labels[0] ? element.labels[0].innerText : ''));
          const recordFill = (element) => {
            if (element.__crawlerLastValue === element.value) return;
            element.__crawlerLastValue = element.value;
            send({ kind: 'fill', label: inputLabel(element), selector: cssPath(element), value: element.value, inputType: element.type || '' });
          };
          document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element) || isTextInput(target)) return;
            const element = target.closest('a, button, [role=button], input[type=submit], input[type=button], label, [onclick]') || target;
            const text = clean(element.innerText || element.value || element.getAttribute('aria-label') || element.getAttribute('title'));
            send({ kind: 'click', text: text.length <= 40 ? text : '', selector: cssPath(element),
              x: event.clientX, y: event.clientY, top: window === window.top });
          }, true);
          document.addEventListener('change', (event) => {
            if (event.target instanceof Element && isTextInput(event.target)) recordFill(event.target);
          }, true);
          document.addEventListener('keydown', (event) => {
            const target = event.target;
            if (event.key !== 'Enter' || !(target instanceof Element) || !isTextInput(target)) return;
            recordFill(target);
            send({ kind: 'press', key: 'Enter', label: inputLabel(target), selector: cssPath(target) });
          }, true);
        })();
        """;

    @Override
    public void startRecording(CrawlerRecordingRequest request) {
        liveViewStore.requestCloseInspection();
        URI startUri = targetPolicy.requireAllowedHttpUrl(request.startUrl());
        if (!acquireCrawlSlot()) throw new BusinessException(ErrorCode.CRAWLER_BUSY);
        boolean pcWindow = request.browserWindow() == com.example.devnote.crawler.dto.CrawlerBrowserWindow.PC_WINDOW;
        liveViewStore.beginRecording(pcWindow);
        try {
            BROWSER_THREAD.execute(() -> recordOnBrowserThread(startUri, pcWindow));
        } catch (RejectedExecutionException exception) {
            liveViewStore.endRecording("녹화 시작 실패", "녹화를 시작하지 못했습니다.");
            CRAWL_SLOT.release();
            throw exception;
        }
    }

    @Override
    public void stopRecording() {
        liveViewStore.stopRecording();
    }

    private void recordOnBrowserThread(URI startUri, boolean pcWindow) {
        Playwright playwright = null;
        Browser browser = null;
        BrowserContext context = null;
        String endReason = "녹화를 마쳤습니다. 기록된 단계를 단계 목록으로 가져올 수 있습니다.";
        List<String> savedNaverCookies = List.of();
        try {
            playwright = Playwright.create();
            browser = openBrowser(playwright, true, pcWindow, new CrawlerProgress());
            Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                .setAcceptDownloads(false)
                .setServiceWorkers(ServiceWorkerPolicy.BLOCK)
                .setLocale("ko-KR");
            if (isNaverHost(startUri)) sessionStore.readNaverSession().ifPresent(contextOptions::setStorageState);
            context = browser.newContext(contextOptions);
            if (isNaverHost(startUri)) savedNaverCookies = naverLoginCookieSignatures(context);
            protectNetwork(context);
            context.exposeBinding("__crawlerRecord", (source, arguments) -> {
                recordBrowserEvent(arguments.length == 0 ? null : arguments[0]);
                return null;
            });
            context.addInitScript(RECORDER_SCRIPT);
            Page page = context.newPage();
            page.setDefaultTimeout(ELEMENT_TIMEOUT_MILLISECONDS);
            page.onDialog(dialog -> dialog.dismiss());
            navigate(page, startUri.toString());
            liveViewStore.addRecordedStep(new CrawlerScenarioStep(
                CrawlerStepType.GOTO, CrawlerTargetMode.TEXT, "", null, null, startUri.toString(), "녹화 시작 주소", null));

            Instant deadline = Instant.now().plus(RECORDING_TIMEOUT);
            Instant nextCapture = Instant.now();
            while (liveViewStore.isRecording() && Instant.now().isBefore(deadline)) {
                // 로그인 후 새 탭이 열려도 그 탭의 화면과 조작을 녹화한다.
                Page openPage = context.pages().stream().filter(candidate -> !candidate.isClosed())
                    .reduce((first, last) -> last).orElse(null);
                if (openPage == null) {
                    endReason = "브라우저 탭이 닫혀 녹화를 마쳤습니다. 지금까지 기록된 단계는 가져올 수 있습니다.";
                    break;
                }
                page = openPage;
                if (isNaverHost(startUri)) {
                    savedNaverCookies = saveRecordingNaverSessionIfChanged(context, savedNaverCookies);
                }
                CrawlerLiveViewStore.ManualCommand command = liveViewStore.pollCommand();
                if (command != null) {
                    if (command.action() == CrawlerManualActionType.STOP) break;
                    if (command.action().isBrowserInput()) {
                        applyManualCommand(page, command);
                        nextCapture = Instant.now();
                    }
                }
                if (!Instant.now().isBefore(nextCapture)) {
                    liveViewStore.capture(page, "녹화 중 · 브라우저에서 원하는 동작을 순서대로 해 주세요");
                    nextCapture = Instant.now().plusMillis(700);
                }
                // 이 대기 중에 브라우저가 보낸 녹화 이벤트(__crawlerRecord)가 처리된다.
                try {
                    page.waitForTimeout(200);
                } catch (PlaywrightException exception) {
                    // 기다리는 사이 탭이 닫히면 다음 탭을 확인한다.
                    if (!page.isClosed()) throw exception;
                }
            }
            if (Instant.now().isAfter(deadline)) endReason = "녹화 제한 시간 15분이 지나 자동으로 멈췄습니다. 지금까지 기록된 단계는 그대로 가져올 수 있습니다.";
        } catch (RuntimeException exception) {
            log.warn("[PlaywrightCrawler] 녹화 중 오류", exception);
            String message = exception.getMessage() == null ? "" : exception.getMessage();
            endReason = message.contains("Target page, context or browser has been closed")
                ? "브라우저 탭 또는 창이 닫혀 녹화를 멈췄습니다. 지금까지 기록된 단계는 가져올 수 있습니다."
                : "녹화 중 오류로 멈췄습니다: " + (message.isBlank() ? exception.getClass().getSimpleName()
                    : message.lines().findFirst().orElse("")) + " 지금까지 기록된 단계는 가져올 수 있습니다.";
        } finally {
            if (context != null && isNaverHost(startUri)) {
                try {
                    saveRecordingNaverSessionIfChanged(context, savedNaverCookies);
                } catch (RuntimeException exception) {
                    log.warn("[PlaywrightCrawler] 녹화 후 네이버 세션 저장 실패", exception);
                    endReason += " 마지막 네이버 로그인 상태 갱신은 확인하지 못했습니다.";
                }
            }
            liveViewStore.endRecording("녹화 종료", endReason);
            closeQuietly(context, browser, playwright);
            CRAWL_SLOT.release();
        }
    }

    /** 기존 쿠키를 다시 저장하지 않고, 녹화 중 새로 로그인하거나 갱신된 쿠키만 저장한다. */
    List<String> saveRecordingNaverSessionIfChanged(BrowserContext context, List<String> savedCookies) {
        List<String> currentCookies = naverLoginCookieSignatures(context);
        if (currentCookies.isEmpty() || currentCookies.equals(savedCookies)) return savedCookies;
        sessionStore.saveNaverSession(context.storageState());
        liveViewStore.addLog("네이버 로그인", "DONE", "이번 녹화의 로그인 상태를 저장했습니다.");
        return currentCookies;
    }

    List<String> naverLoginCookieSignatures(BrowserContext context) {
        return context.cookies().stream()
            .filter(cookie -> "NID_AUT".equals(cookie.name) || "NID_SES".equals(cookie.name))
            .map(cookie -> cookie.domain + "/" + cookie.name + "=" + cookie.value)
            .sorted()
            .toList();
    }

    /** 브라우저에서 온 녹화 이벤트(JSON 문자열)를 단계로 바꿔 저장한다. */
    private void recordBrowserEvent(Object payload) {
        if (!(payload instanceof String json)) return;
        try {
            JsonNode event = JSON.readTree(json);
            String kind = event.path("kind").asText("");
            String selector = event.path("selector").asText("");
            String label = event.path("label").asText("");
            CrawlerTargetMode mode = label.isBlank() ? CrawlerTargetMode.SELECTOR : CrawlerTargetMode.TEXT;
            String target = label.isBlank() ? selector : label;
            switch (kind) {
                case "click" -> {
                    String text = event.path("text").asText("");
                    boolean top = event.path("top").asBoolean(false);
                    Double x = top && event.has("x") ? event.path("x").asDouble() : null;
                    Double y = top && event.has("y") ? event.path("y").asDouble() : null;
                    liveViewStore.addRecordedStep(new CrawlerScenarioStep(
                        CrawlerStepType.CLICK,
                        text.isBlank() ? CrawlerTargetMode.SELECTOR : CrawlerTargetMode.TEXT,
                        text.isBlank() ? selector : text, x, y, "", "녹화", null));
                }
                case "fill" -> {
                    boolean password = "password".equalsIgnoreCase(event.path("inputType").asText(""));
                    liveViewStore.addRecordedStep(new CrawlerScenarioStep(
                        CrawlerStepType.FILL, mode, target, null, null,
                        password ? "{{password}}" : event.path("value").asText(""),
                        password ? "녹화 · 비밀번호는 {{password}}로 기록" : "녹화", null));
                }
                case "press" -> liveViewStore.addRecordedStep(new CrawlerScenarioStep(
                    CrawlerStepType.PRESS, mode, target, null, null, event.path("key").asText("Enter"), "녹화", null));
                default -> log.debug("[PlaywrightCrawler] 알 수 없는 녹화 이벤트 kind={}", kind);
            }
        } catch (JsonProcessingException exception) {
            log.debug("[PlaywrightCrawler] 녹화 이벤트 해석 실패");
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 목록 자동 감지: 반복 항목 선택자를 비우면 화면에서 가장 큰 표·목록을 찾는다.
    // ═══════════════════════════════════════════════════════════════════

    /** 자동 감지한 목록: 행 Locator, 열 제목, 사람이 읽을 설명 */
    private record AutoList(Locator rows, List<String> headers, String description) {
    }

    /**
     * 본문과 모든 iframe에서 행이 가장 많은 표(3행 이상, 칸 2개 이상)를 찾고, 없으면 링크가 들어 있는 목록(li)을 찾는다.
     * 찾은 행에 data-crawler-row 표시를 붙여 그 iframe의 Locator로 다시 가리킨다.
     */
    private AutoList detectList(Page page) {
        AutoList best = null;
        int bestCount = 0;
        for (Frame frame : page.frames()) {
            try {
                Object raw = frame.evaluate(DETECT_LIST_SCRIPT);
                if (!(raw instanceof Map<?, ?> result)) continue;
                int count = ((Number) result.get("count")).intValue();
                if (count <= bestCount) continue;
                List<String> headers = new ArrayList<>();
                if (result.get("headers") instanceof List<?> list) list.forEach(header -> headers.add(String.valueOf(header)));
                String kind = String.valueOf(result.get("kind"));
                best = new AutoList(
                    frame.locator("[data-crawler-row]"),
                    List.copyOf(headers),
                    ("table".equals(kind) ? "표 " : "목록 ") + count + "행"
                        + (headers.stream().allMatch(String::isBlank) ? "" : " (열: " + String.join(", ", headers.stream().filter(header -> !header.isBlank()).toList()) + ")")
                        + (frame == page.mainFrame() ? "" : " · iframe 안")
                );
                bestCount = count;
            } catch (PlaywrightException | ClassCastException exception) {
                log.debug("[PlaywrightCrawler] 목록 자동 감지 실패 frame={}", frame.url());
            }
        }
        return best;
    }

    private static final String DETECT_LIST_SCRIPT = """
        () => {
          document.querySelectorAll('[data-crawler-row]').forEach((element) => element.removeAttribute('data-crawler-row'));
          const visible = (element) => !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
          const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
          let best = null;
          for (const table of document.querySelectorAll('table')) {
            if (!visible(table)) continue;
            const rows = [...table.querySelectorAll('tr')].filter((row) => row.closest('table') === table
              && row.querySelectorAll(':scope > td').length >= 2 && visible(row));
            if (rows.length >= 3 && (!best || rows.length > best.rows.length)) {
              const headerCells = [...table.querySelectorAll('thead th, tr:first-child > th')].filter((cell) => cell.closest('table') === table);
              best = { kind: 'table', rows, headers: headerCells.map((cell) => clean(cell.innerText)) };
            }
          }
          if (!best) {
            for (const list of document.querySelectorAll('ul, ol')) {
              if (!visible(list)) continue;
              const rows = [...list.children].filter((item) => item.tagName === 'LI' && visible(item) && item.querySelector('a[href]'));
              if (rows.length >= 3 && (!best || rows.length > best.rows.length)) best = { kind: 'list', rows, headers: [] };
            }
          }
          if (!best) return null;
          best.rows.forEach((row, index) => row.setAttribute('data-crawler-row', String(index)));
          return { kind: best.kind, count: best.rows.length, headers: best.headers };
        }
        """;

    /**
     * 필드를 따로 정하지 않았을 때 한 행을 읽는다.
     * 표: 각 칸을 열 제목(제목·작성자·작성일·조회수 등)으로, 목록: 전체 글자를 '내용'으로. 첫 링크는 '링크'로 넣는다.
     * 열 제목이 칸보다 적으면(첫 칸 '번호'에 제목이 없는 게시판 등) 오른쪽 끝을 맞춰 붙인다.
     */
    private Map<String, String> autoExtractItem(Locator row, List<String> headers, String pageUrl, int pageNumber) {
        Object raw = row.evaluate("""
            (row, headers) => {
              const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
              const result = {};
              const cells = [...row.querySelectorAll(':scope > td')];
              if (cells.length === 0) {
                result['내용'] = clean(row.innerText);
              } else {
                const offset = Math.max(0, cells.length - (headers.length || cells.length));
                cells.forEach((cell, index) => {
                  const header = headers[index - offset];
                  let name = header ? header : (index === 0 && offset > 0 ? '번호' : '열' + (index + 1));
                  if (Object.prototype.hasOwnProperty.call(result, name)) name = name + ' ' + (index + 1);
                  result[name] = clean(cell.innerText);
                });
              }
              const link = row.querySelector('a[href]:not([href^="javascript"]):not([href="#"])');
              result['링크'] = link ? new URL(link.getAttribute('href'), document.baseURI).href : '';
              return result;
            }
            """, headers);
        Map<String, String> item = new LinkedHashMap<>();
        if (raw instanceof Map<?, ?> values) {
            values.forEach((key, value) -> item.put(String.valueOf(key), normalizeText(value == null ? "" : String.valueOf(value))));
        }
        item.put("_pageUrl", pageUrl);
        item.put("_pageNumber", String.valueOf(pageNumber));
        return item;
    }

    /** 값 뽑기에 쓸 글자: '제목' 칸이 있으면 그것, 없으면 상세내용·이미지주소를 뺀 나머지 칸을 이어 붙인다. */
    private String titleTextOf(Map<String, String> item) {
        String title = item.getOrDefault("제목", "");
        if (!title.isBlank()) return title;
        StringBuilder text = new StringBuilder();
        item.forEach((name, value) -> {
            if (name.startsWith("_") || name.equals(DETAIL_FIELD) || name.equals(DETAIL_IMAGE_FIELD)) return;
            if (!value.isBlank()) text.append(value).append(' ');
        });
        return text.toString().trim();
    }

    /** 결과 표의 열 이름: 필드를 정했으면 그 이름, 자동이면 수집된 항목의 열 이름(처음 나온 순서). */
    private List<String> fieldNamesOf(CrawlerRunRequest request, List<Map<String, String>> items) {
        java.util.LinkedHashSet<String> names = new java.util.LinkedHashSet<>();
        if (request.usesSteps()) {
            request.steps().stream().filter(step -> step.type() == CrawlerStepType.COLLECT)
                .forEach(step -> request.forCollectionStep(step).fields().forEach(field -> names.add(field.name().trim())));
            items.forEach(item -> item.keySet().stream().filter(name -> !name.startsWith("_")).forEach(names::add));
        } else if (!request.fields().isEmpty()) {
            request.fields().forEach(field -> names.add(field.name().trim()));
        } else {
            items.forEach(item -> item.keySet().stream()
                .filter(name -> !name.startsWith("_") && !name.equals(DETAIL_FIELD)).forEach(names::add));
        }
        if (request.parseListing()) names.addAll(CrawlerListingParser.FIELDS);
        if (request.collectDetail()) {
            names.add(DETAIL_FIELD);
            names.add(DETAIL_IMAGE_FIELD);
        }
        return List.copyOf(names);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 다음 페이지 자동 이동: 다음 페이지 버튼 선택자를 비우면 페이지 번호(현재+1) → '다음' 버튼 순서로 찾는다.
    // ═══════════════════════════════════════════════════════════════════

    private static final String FIND_NEXT_PAGE_SCRIPT = """
        () => {
          document.querySelectorAll('[data-crawler-next]').forEach((element) => element.removeAttribute('data-crawler-next'));
          const visible = (element) => !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
          const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
          const disabled = (element) => element.disabled || element.getAttribute('aria-disabled') === 'true'
            || /(^|\\s)(disabled|off)(\\s|$)/i.test(element.className || '');
          const pagingArea = (element) => element.closest('[class*="pagin" i], [class*="paging" i], [class*="page-nav" i], [class*="pagenav" i], [role="navigation"], nav');
          const clickables = [...document.querySelectorAll('a, button, [role="button"], [role="link"]')]
            .filter((element) => visible(element) && !disabled(element));
          // 1) 현재 페이지 표시(aria-current, selected, on, active) 다음 번호
          let current = null;
          for (const element of document.querySelectorAll('[aria-current="page"], [aria-current="true"], [class*="pagin" i] .on, [class*="pagin" i] .selected, [class*="pagin" i] .active, [class*="paging" i] .on, [class*="paging" i] .selected, [class*="paging" i] strong')) {
            const number = parseInt(clean(element.innerText), 10);
            if (!Number.isNaN(number) && visible(element)) { current = number; break; }
          }
          const mark = (element, how) => { element.setAttribute('data-crawler-next', '1'); return how; };
          if (current !== null) {
            const next = clickables.find((element) => pagingArea(element) && clean(element.innerText) === String(current + 1));
            if (next) return mark(next, '페이지 번호 ' + (current + 1));
          }
          // 2) '다음' / Next / › / > 버튼(페이지 영역 안 우선)
          const nextWords = /^(다음|다음 ?페이지|다음 ?목록|next|next page|›|»|>|＞|▶)$/i;
          const isNext = (element) => nextWords.test(clean(element.innerText))
            || /다음|next/i.test(element.getAttribute('aria-label') || element.getAttribute('title') || '');
          const inPaging = clickables.find((element) => pagingArea(element) && isNext(element));
          if (inPaging) return mark(inPaging, '다음 버튼');
          const anywhere = clickables.find((element) => isNext(element) && !element.closest('header, [class*="gnb" i]'));
          if (anywhere) return mark(anywhere, '다음 버튼');
          return null;
        }
        """;

    /** 다음 페이지 버튼 선택자가 없을 때 본문과 iframe에서 다음 페이지 버튼을 찾아 누른다. 찾지 못하면 false. */
    private boolean autoMoveToNextPage(Page page, CrawlerRunRequest request) {
        for (Frame frame : page.frames()) {
            try {
                Object how = frame.evaluate(FIND_NEXT_PAGE_SCRIPT);
                if (how == null) continue;
                liveViewStore.capture(page, "다음 페이지로 이동: " + how);
                frame.locator("[data-crawler-next]").first().click();
                settleAfterAction(page, request);
                return true;
            } catch (PlaywrightException exception) {
                log.debug("[PlaywrightCrawler] 다음 페이지 자동 이동 실패 frame={}", frame.url());
            }
        }
        return false;
    }

    /**
     * 다음 페이지로 넘기거나 상세글을 열기 전에 '페이지 대기(ms)'만큼 쉰다.
     * 상대 서버에 요청이 몰리지 않게 하고, 너무 잦은 요청으로 차단되는 것을 줄이기 위한 것이다.
     */
    private void politeDelay(Page page, CrawlerRunRequest request, String reason) {
        long delay = request.waitAfterNavigationMillis();
        if (delay <= 0) return;
        liveViewStore.capture(page, reason + " " + String.format(java.util.Locale.ROOT, "%.1f", delay / 1000.0) + "초 대기 (요청 간격)");
        page.waitForTimeout(delay);
    }

    private String safeInnerText(Locator locator) {
        try {
            return locator.innerText();
        } catch (PlaywrightException exception) {
            return "";
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 상세글 수집: 각 항목의 링크를 같은 로그인 상태의 새 탭에서 열어 본문을 '상세내용'으로 담는다.
    // ═══════════════════════════════════════════════════════════════════

    private static final String DETAIL_FIELD = "상세내용";
    private static final String DETAIL_IMAGE_FIELD = "이미지주소";
    private static final int MAX_DETAIL_IMAGES = 20;
    private static final int MAX_DETAIL_LENGTH = 20_000;

    /** 본문으로 자주 쓰이는 영역(네이버 카페·블로그, 일반 게시판, article/main 순) */
    private static final List<String> DETAIL_CANDIDATES = List.of(
        ".se-main-container", ".se-viewer", ".ContentRenderer", ".article_viewer", ".ArticleContentBox .article_container",
        ".article_container", "#tbody", ".tbody", "#postViewArea", "#content-area",
        ".view_content", ".board_view .content", ".post-content", ".entry-content", "[itemprop=articleBody]",
        "article", "main"
    );
    private static final int DETAIL_ATTEMPTS = 3;
    /** 연속으로 이만큼 실패하면 요청 제한에 걸린 것으로 보고 한 번 길게 쉰다. */
    private static final int DETAIL_FAILURE_BACKOFF_AFTER = 3;
    private static final int DETAIL_FAILURE_BACKOFF_MILLIS = 30_000;

    private Page openDetailPage(Page listPage) {
        Page detailPage = listPage.context().newPage();
        detailPage.setDefaultTimeout(ELEMENT_TIMEOUT_MILLISECONDS);
        detailPage.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MILLISECONDS);
        detailPage.onDialog(dialog -> dialog.dismiss());
        return detailPage;
    }

    private void closeDetailPage(Page detailPage) {
        if (detailPage == null) return;
        try {
            detailPage.close();
        } catch (PlaywrightException ignored) {
            log.debug("[PlaywrightCrawler] 상세글 탭 닫기 실패");
        }
    }

    /**
     * 한 페이지에서 모은 글들의 상세글을 상세글 탭에서 하나씩 열어 '상세내용'에 담는다.
     * detailFailures[0]: 시도한 글 수, [1]: 실패한 글 수(누적)
     */
    private void collectDetailsOfPage(
        Page detailPage, CrawlerRunRequest request, List<Map<String, String>> pageItems,
        String pageProgress, int[] detailFailures, CrawlerProgress progress
    ) {
        int consecutiveFailures = 0;
        for (int index = 0; index < pageItems.size(); index++) {
            Map<String, String> item = pageItems.get(index);
            String stage = pageProgress + " 상세글 " + (index + 1) + "/" + pageItems.size();
            progress.at(stage, "상세글 링크가 열리는지, 본문 선택자가 맞는지 확인해 주세요.");
            liveViewStore.updateRunningStepDetail(stage + " 읽는 중 · 실패 " + detailFailures[1] + "건");
            detailFailures[0]++;
            String link = detailLinkOf(item, request);
            if (link.isBlank()) {
                item.put(DETAIL_FIELD, "(링크가 없어 상세글을 가져오지 못함)");
                item.put(DETAIL_IMAGE_FIELD, "");
                detailFailures[1]++;
                continue;
            }
            // 본문이 늦게 그려지거나 요청이 막히는 경우가 있어 최대 3번까지 다시 연다.
            DetailContent detail = null;
            String lastReason = "";
            for (int attempt = 1; attempt <= DETAIL_ATTEMPTS && detail == null; attempt++) {
                if (attempt > 1) {
                    liveViewStore.updateRunningStepDetail(stage + " 다시 시도 " + attempt + "/" + DETAIL_ATTEMPTS
                        + " · 실패 " + detailFailures[1] + "건");
                    detailPage.waitForTimeout(1_000L * attempt);
                }
                try {
                    URI uri = targetPolicy.requireAllowedHttpUrl(link);
                    politeDelay(detailPage, request, stage + (attempt > 1 ? " 다시 열기 전" : " 열기 전"));
                    navigate(detailPage, uri.toString());
                    DetailContent read = readDetail(detailPage, request.detailSelector());
                    liveViewStore.capture(detailPage, stage);
                    if (!read.text().isBlank()) {
                        detail = read;
                    } else {
                        lastReason = "본문을 찾지 못함";
                    }
                } catch (BusinessException | PlaywrightException exception) {
                    lastReason = exception.getMessage() == null ? exception.getClass().getSimpleName()
                        : exception.getMessage().lines().findFirst().orElse("");
                }
            }

            if (detail == null) {
                item.put(DETAIL_FIELD, "(상세글을 가져오지 못함: " + lastReason + " · " + DETAIL_ATTEMPTS + "번 시도)");
                item.putIfAbsent(DETAIL_IMAGE_FIELD, "");
                detailFailures[1]++;
                consecutiveFailures++;
                if (consecutiveFailures >= DETAIL_FAILURE_BACKOFF_AFTER && index < pageItems.size() - 1) {
                    // 연속 실패는 요청 제한일 수 있다. 한 번 길게 쉬고 이어서 진행한다.
                    liveViewStore.updateRunningStepDetail(stage + " 연속 실패로 "
                        + (DETAIL_FAILURE_BACKOFF_MILLIS / 1000) + "초 쉬는 중 (요청 제한 가능성)");
                    detailPage.waitForTimeout(DETAIL_FAILURE_BACKOFF_MILLIS);
                    consecutiveFailures = 0;
                }
                continue;
            }

            consecutiveFailures = 0;
            item.put(DETAIL_IMAGE_FIELD, String.join("\n", detail.imageUrls()));
            // 제목에서 못 읽은 값(보증금·월세 등)은 상세글 본문에서 한 번 더 찾는다.
            if (request.parseListing()) CrawlerListingParser.fillMissing(item, detail.text());
            item.put(DETAIL_FIELD, detail.text().length() > MAX_DETAIL_LENGTH
                ? detail.text().substring(0, MAX_DETAIL_LENGTH) + "…(이하 생략)" : detail.text());
        }
    }

    /** 상세글 주소: 자동 필드면 '링크', 직접 정한 필드면 http(s) 주소가 들어 있는 첫 필드 */
    private String detailLinkOf(Map<String, String> item, CrawlerRunRequest request) {
        String link = item.getOrDefault("링크", "");
        if (!link.isBlank()) return link;
        for (CrawlerFieldRequest field : request.fields()) {
            String value = item.getOrDefault(field.name().trim(), "");
            if (value.startsWith("http://") || value.startsWith("https://")) return value;
        }
        return "";
    }

    /** 상세글 본문 글자와 본문 안 이미지 주소(최대 20개) */
    private record DetailContent(String text, List<String> imageUrls) {
    }

    /**
     * 본문과 모든 iframe에서 본문 영역을 찾아 글자와 이미지 주소를 읽는다.
     * 본문이 늦게 그려지는 화면(네이버 카페 iframe 등)을 위해 최대 15초까지 기다리고,
     * 알려진 본문 선택자가 모두 없으면 글자가 가장 많은 영역을 본문으로 본다.
     * 이미지는 주소만 담는다(이미지 파일은 내려받지 않는다).
     */
    private DetailContent readDetail(Page detailPage, String detailSelector) {
        List<String> selectors = detailSelector == null || detailSelector.isBlank() ? DETAIL_CANDIDATES : List.of(detailSelector.trim());
        try {
            detailPage.waitForLoadState(LoadState.LOAD, new Page.WaitForLoadStateOptions().setTimeout(10_000));
        } catch (PlaywrightException exception) {
            log.debug("[PlaywrightCrawler] 상세글 로딩 대기 시간 초과 url={}", detailPage.url());
        }
        Instant deadline = Instant.now().plusMillis(15_000);
        do {
            for (String selector : selectors) {
                for (Frame frame : detailPage.frames()) {
                    try {
                        Locator area = frame.locator(selector).filter(new Locator.FilterOptions().setVisible(true)).first();
                        if (area.count() == 0) continue;
                        String text = normalizeDetail(area.innerText());
                        if (text.length() >= 5) return new DetailContent(text, readImageUrls(area));
                    } catch (PlaywrightException ignored) {
                        // 사라진 iframe·선택자 문법 오류는 다음 후보로 넘어간다.
                    }
                }
            }
            detailPage.waitForTimeout(400);
        } while (Instant.now().isBefore(deadline));
        return readLargestTextBlock(detailPage);
    }

    /** 알려진 본문 선택자가 없을 때: 본문과 iframe에서 글자가 가장 많은 영역을 본문으로 본다. */
    private DetailContent readLargestTextBlock(Page detailPage) {
        for (Frame frame : detailPage.frames()) {
            try {
                Object raw = frame.evaluate("""
                    () => {
                      document.querySelectorAll('[data-crawler-body]').forEach((e) => e.removeAttribute('data-crawler-body'));
                      const skip = /^(nav|header|footer|script|style|aside)$/i;
                      let best = null;
                      let bestLength = 0;
                      for (const element of document.querySelectorAll('div, section, td, article')) {
                        if (skip.test(element.tagName) || element.closest('nav, header, footer')) continue;
                        const text = (element.innerText || '').trim();
                        // 자식이 더 알맞은 후보일 수 있으므로 '글자 대비 자식 수'가 적은 쪽을 고른다.
                        if (text.length > bestLength && text.length >= 50 && element.querySelectorAll('a').length < 50) {
                          best = element;
                          bestLength = text.length;
                        }
                      }
                      if (!best) return null;
                      best.setAttribute('data-crawler-body', '1');
                      return bestLength;
                    }
                    """);
                if (raw == null) continue;
                Locator area = frame.locator("[data-crawler-body]").first();
                if (area.count() == 0) continue;
                String text = normalizeDetail(area.innerText());
                if (text.length() >= 50) return new DetailContent(text, readImageUrls(area));
            } catch (PlaywrightException exception) {
                log.debug("[PlaywrightCrawler] 본문 자동 찾기 실패 frame={}", frame.url());
            }
        }
        return new DetailContent("", List.of());
    }

    /** 본문 영역 안 이미지의 실제 주소를 모은다(지연 로딩 속성 포함). */
    private List<String> readImageUrls(Locator area) {
        try {
            Object raw = area.evaluate("""
                (element, limit) => [...element.querySelectorAll('img')]
                  .map((image) => image.currentSrc || image.getAttribute('src')
                    || image.getAttribute('data-lazy-src') || image.getAttribute('data-src') || '')
                  .filter((url) => url && !url.startsWith('data:'))
                  .map((url) => new URL(url, document.baseURI).href)
                  .filter((url, index, all) => all.indexOf(url) === index)
                  .slice(0, limit)
                """, MAX_DETAIL_IMAGES);
            List<String> urls = new ArrayList<>();
            if (raw instanceof List<?> values) values.forEach(value -> urls.add(String.valueOf(value)));
            return List.copyOf(urls);
        } catch (PlaywrightException exception) {
            return List.of();
        }
    }

    /** 줄바꿈은 살리고 연속 공백·빈 줄만 정리한다. */
    private String normalizeDetail(String text) {
        if (text == null) return "";
        return text.replace("\r", "")
            .replaceAll("[ \\t\\u00A0]+", " ")
            .replaceAll(" *\\n *", "\n")
            .replaceAll("\\n{3,}", "\n\n")
            .trim();
    }

    private record CollectionSummary(int crawledPageCount, int scannedItemCount) {
    }
}
