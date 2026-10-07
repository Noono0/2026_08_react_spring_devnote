package com.example.devnote.crawler.service;

import com.example.devnote.crawler.dto.CrawlerCollectionFilterRequest;
import com.example.devnote.crawler.dto.CrawlerFieldRequest;
import com.example.devnote.crawler.dto.CrawlerLoginMode;
import com.example.devnote.crawler.dto.CrawlerLoginRequest;
import com.example.devnote.crawler.dto.CrawlerMatchMode;
import com.example.devnote.crawler.dto.CrawlerPageSearchRequest;
import com.example.devnote.crawler.dto.CrawlerRunRequest;
import com.example.devnote.crawler.dto.CrawlerRunResponse;
import com.example.devnote.crawler.dto.CrawlerValueSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.util.List;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "RUN_CRAWLER_EXTERNAL_TEST", matches = "true")
class PlaywrightCrawlerExternalTest {
    @Test
    void crawlsRenderedPublicPageWithChromium(@TempDir Path temporaryDirectory) {
        PlaywrightCrawlerEngine engine = new PlaywrightCrawlerEngine(
            new CrawlerTargetPolicy(),
            new CrawlerItemMatcher(),
            new CrawlerSessionStore(temporaryDirectory.toString()),
            new CrawlerLiveViewStore(),
            // 이 테스트는 이 컴퓨터에서 Chromium을 직접 띄워 확인하므로 local 모드를 쓴다.
            new CrawlerBrowserSettings("local", "", "http://127.0.0.1:9222")
        );
        CrawlerRunRequest request = new CrawlerRunRequest(
            true,
            "https://quotes.toscrape.com/",
            new CrawlerLoginRequest(CrawlerLoginMode.NONE, "", "", "", "", "", "", ""),
            new CrawlerPageSearchRequest(false, "", "", ""),
            "",
            ".quote",
            List.of(
                new CrawlerFieldRequest("문구", ".text", CrawlerValueSource.TEXT, ""),
                new CrawlerFieldRequest("작성자", ".author", CrawlerValueSource.TEXT, "")
            ),
            new CrawlerCollectionFilterRequest(CrawlerMatchMode.ALL, List.of()),
            "",
            1,
            0,
            20
        );

        CrawlerRunResponse response = engine.crawl(request);

        assertThat(response.crawledPageCount()).isEqualTo(1);
        assertThat(response.scannedItemCount()).isPositive();
        assertThat(response.items()).isNotEmpty();
        assertThat(response.items().getFirst().get("문구")).isNotBlank();
    }
}
