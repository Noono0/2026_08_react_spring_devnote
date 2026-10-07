package com.example.devnote.crawler.service;

import com.example.devnote.crawler.dto.CrawlerBrowserStatusResponse;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 브라우저 실행 위치(local/remote) 설정과 원격 브라우저 연결 확인을 검사한다.
 * 실제 Chrome 대신 /json/version에만 200으로 답하는 작은 HTTP 서버를 띄워 "원격 Chrome"을 흉내 낸다.
 */
class CrawlerBrowserSettingsTest {

    @Test
    void localModeIsAlwaysReadyWithoutCheckingRemoteBrowser() {
        CrawlerBrowserSettings settings = new CrawlerBrowserSettings("local", "", "http://127.0.0.1:1");

        CrawlerBrowserStatusResponse status = settings.checkStatus();

        assertThat(settings.isRemoteMode()).isFalse();
        assertThat(status.mode()).isEqualTo("LOCAL");
        assertThat(status.ready()).isTrue();
        assertThat(status.remoteBrowserConnected()).isNull();
    }

    @Test
    void remoteModeIsReadyOnlyWhenChromeDevToolsAnswers() throws IOException {
        HttpServer fakeChrome = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fakeChrome.createContext("/json/version", exchange -> {
            byte[] body = "{\"Browser\":\"Chrome\"}".getBytes();
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        fakeChrome.start();
        try {
            CrawlerBrowserSettings settings = new CrawlerBrowserSettings(
                "REMOTE", "http://localhost:" + fakeChrome.getAddress().getPort(), "");

            CrawlerBrowserStatusResponse status = settings.checkStatus();

            assertThat(settings.isRemoteMode()).isTrue();
            assertThat(status.ready()).isTrue();
            assertThat(status.remoteBrowserConnected()).isTrue();
            // Chrome은 Host가 IP가 아니면 거부하므로 localhost를 IP로 바꿔 연결한다.
            assertThat(settings.browserEndpoint()).isEqualTo("http://127.0.0.1:" + fakeChrome.getAddress().getPort());
        } finally {
            fakeChrome.stop(0);
        }
    }

    @Test
    void remoteModeIsNotReadyWhenNothingListens() throws IOException {
        int unusedPort;
        // 빈 포트를 하나 얻은 뒤 바로 닫아, 아무도 듣고 있지 않은 주소를 만든다.
        try (ServerSocket socket = new ServerSocket(0)) {
            unusedPort = socket.getLocalPort();
        }
        CrawlerBrowserSettings settings = new CrawlerBrowserSettings("remote", "http://127.0.0.1:" + unusedPort, "");

        CrawlerBrowserStatusResponse status = settings.checkStatus();

        assertThat(status.ready()).isFalse();
        assertThat(status.remoteBrowserConnected()).isFalse();
        assertThat(status.message()).contains("start-pc-chrome.cmd");
    }

    @Test
    void blankRemoteUrlFallsBackToPcBrowserUrl() {
        // compose가 CRAWLER_REMOTE_BROWSER_URL을 빈 값으로 넘겨도 기존 PC Chrome 주소(local Docker의 "PC에 새 창")를 그대로 쓴다.
        CrawlerBrowserSettings settings = new CrawlerBrowserSettings("local", "  ", "http://127.0.0.1:9222");

        assertThat(settings.browserEndpoint()).isEqualTo("http://127.0.0.1:9222");
    }

    @Test
    void misspelledModeFailsAtStartupInsteadOfSilentlyRunningChromiumOnServer() {
        assertThatThrownBy(() -> new CrawlerBrowserSettings("remtoe", "http://127.0.0.1:9222", ""))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("local 또는 remote");
    }
}
