package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.crawler.dto.CrawlerBrowserStatusResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

/**
 * 크롤러 브라우저(Chromium)를 "어디에서" 띄울지 정하고, 원격 브라우저 연결 상태를 확인합니다.
 *
 * [CRAWLER_BROWSER_MODE]
 *   local  (기본) : 백엔드가 있는 컴퓨터에서 Chromium을 직접 띄운다. 로컬 개발용.
 *   remote        : 백엔드는 명령만 내리고, 다른 컴퓨터에 열어 둔 Chrome에 원격 디버깅(CDP)으로 연결한다.
 *                   운영 서버(메모리 1GB)에서 Chromium을 띄우면 메모리 부족으로 서버 전체가 멈출 수 있어 운영은 remote로 고정한다.
 *
 * [왜 화면 체크박스가 아니라 서버 설정일까?]
 *   "어디에서 실행할지"는 환경마다 답이 정해져 있다(로컬=local, 운영=remote).
 *   화면에서 고를 수 있게 하면 운영에서 실수로 local을 골라 서버가 멈출 수 있다. 위험한 선택지는 화면에 두지 않는다.
 *
 * [원격 주소 CRAWLER_REMOTE_BROWSER_URL]
 *   예: http://100.101.102.103:9222 (Tailscale 사설망 안의 내 PC). 비어 있으면 CRAWLER_PC_BROWSER_URL을 쓴다.
 *   ★ 이 포트는 브라우저 전체를 조종할 수 있는 통로라 인터넷에 그대로 열면 절대 안 된다. 사설망(Tailscale 등) 안에서만 쓴다.
 */
@Component
public class CrawlerBrowserSettings {
    /** 연결 확인 요청을 기다리는 최대 시간. 상태 확인 때문에 화면이 오래 멈추지 않게 짧게 둔다. */
    private static final Duration STATUS_TIMEOUT = Duration.ofSeconds(2);

    private final boolean remoteMode;
    private final String browserUrl;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(STATUS_TIMEOUT).build();

    public CrawlerBrowserSettings(
        @Value("${CRAWLER_BROWSER_MODE:local}") String browserMode,
        @Value("${CRAWLER_REMOTE_BROWSER_URL:}") String remoteBrowserUrl,
        @Value("${CRAWLER_PC_BROWSER_URL:http://host.docker.internal:9222}") String pcBrowserUrl
    ) {
        String normalizedMode = browserMode == null ? "" : browserMode.trim().toLowerCase(Locale.ROOT);
        // 오타(예: "remtoe")를 조용히 local로 처리하면 운영에서 서버가 Chromium을 띄우게 된다. 시작할 때 바로 실패시킨다.
        if (!normalizedMode.equals("local") && !normalizedMode.equals("remote")) {
            throw new IllegalStateException("CRAWLER_BROWSER_MODE는 local 또는 remote만 쓸 수 있습니다: " + browserMode);
        }
        this.remoteMode = normalizedMode.equals("remote");
        // ★ compose는 값을 비워도 "빈 문자열"로 넘긴다. ${A:${B}} 형태의 기본값은 A가 "없을 때"만 쓰이고
        //   "비어 있을 때"는 쓰이지 않으므로, 비어 있으면 PC 주소를 쓰도록 여기서 직접 고른다.
        String chosenUrl = remoteBrowserUrl == null || remoteBrowserUrl.isBlank() ? pcBrowserUrl : remoteBrowserUrl;
        this.browserUrl = chosenUrl == null ? "" : chosenUrl.trim();
    }

    /** remote 모드면 true. 이때는 Chromium을 직접 띄우지 않고 항상 원격 브라우저에 연결한다. */
    public boolean isRemoteMode() {
        return remoteMode;
    }

    /**
     * Playwright connectOverCDP에 넘길 주소.
     * Chrome 원격 디버깅은 Host 헤더가 IP나 localhost가 아니면 거부하므로, 호스트 이름을 IP 주소로 바꿔 돌려준다.
     */
    public String browserEndpoint() {
        URI uri = parseBrowserUrl();
        try {
            String address = InetAddress.getByName(uri.getHost()).getHostAddress();
            // IPv6 주소는 URL에 넣을 때 대괄호로 감싸야 한다. (예: http://[::1]:9222)
            String host = address.contains(":") ? "[" + address + "]" : address;
            return uri.getScheme() + "://" + host + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
        } catch (UnknownHostException exception) {
            throw new BusinessException(
                ErrorCode.CRAWLER_EXECUTION_FAILED,
                "브라우저 주소(" + uri.getHost() + ")를 찾지 못했습니다. CRAWLER_REMOTE_BROWSER_URL 설정을 확인해 주세요."
            );
        }
    }

    /**
     * 화면에 보여 줄 실행 준비 상태.
     *   local  : 서버에서 바로 띄우므로 항상 준비됨(원격 연결 여부는 해당 없음 → null).
     *   remote : 원격 Chrome의 /json/version에 짧게 물어봐 응답하면 연결됨.
     */
    public CrawlerBrowserStatusResponse checkStatus() {
        if (!remoteMode) {
            return new CrawlerBrowserStatusResponse("LOCAL", true, null, "이 서버에서 Chromium을 직접 실행합니다.");
        }
        boolean connected = isRemoteBrowserReachable();
        return new CrawlerBrowserStatusResponse(
            "REMOTE",
            connected,
            connected,
            connected
                ? "원격 브라우저에 연결할 수 있습니다."
                : "원격 브라우저에 연결할 수 없습니다. 크롤링용 PC에서 start-pc-chrome.cmd로 Chrome을 열고 Tailscale이 켜져 있는지 확인해 주세요."
        );
    }

    /** Chrome 원격 디버깅의 버전 정보 주소(/json/version)가 200으로 답하면 연결 가능한 것으로 본다. */
    private boolean isRemoteBrowserReachable() {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(browserEndpoint() + "/json/version"))
                .timeout(STATUS_TIMEOUT)
                .GET()
                .build();
            return httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200;
        } catch (BusinessException | IOException | IllegalArgumentException exception) {
            // 주소를 못 찾거나, 연결이 거부되거나, 시간이 넘으면 "연결 안 됨"으로 보고한다(화면이 원인을 안내한다).
            return false;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private URI parseBrowserUrl() {
        try {
            URI uri = URI.create(browserUrl);
            if (uri.getScheme() == null || uri.getHost() == null) throw new IllegalArgumentException("scheme or host missing");
            return uri;
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(
                ErrorCode.CRAWLER_EXECUTION_FAILED,
                "브라우저 주소 형식이 올바르지 않습니다(예: http://100.64.0.1:9222). CRAWLER_REMOTE_BROWSER_URL 설정을 확인해 주세요."
            );
        }
    }
}
