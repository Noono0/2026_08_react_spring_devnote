package com.example.devnote.crawler.service;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.options.Cookie;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class PlaywrightCrawlerRecordingSessionTest {
    @Test
    void savesOnlyWhenNaverLoginCookiesChangeDuringRecording() {
        CrawlerSessionStore sessionStore = mock(CrawlerSessionStore.class);
        CrawlerLiveViewStore liveViewStore = mock(CrawlerLiveViewStore.class);
        BrowserContext context = mock(BrowserContext.class);
        PlaywrightCrawlerEngine engine = new PlaywrightCrawlerEngine(
            mock(CrawlerTargetPolicy.class), mock(CrawlerItemMatcher.class), sessionStore, liveViewStore,
            mock(CrawlerBrowserSettings.class)
        );
        when(context.cookies()).thenReturn(List.of(cookie("NID_SES", "old")));
        List<String> savedCookies = engine.naverLoginCookieSignatures(context);

        assertThat(engine.saveRecordingNaverSessionIfChanged(context, savedCookies)).isEqualTo(savedCookies);
        verifyNoMoreInteractions(sessionStore);

        when(context.cookies()).thenReturn(List.of(cookie("NID_SES", "new")));
        when(context.storageState()).thenReturn("new-storage-state");
        List<String> updatedCookies = engine.saveRecordingNaverSessionIfChanged(context, savedCookies);
        verify(sessionStore).saveNaverSession("new-storage-state");

        assertThat(engine.saveRecordingNaverSessionIfChanged(context, updatedCookies)).isEqualTo(updatedCookies);
        verifyNoMoreInteractions(sessionStore);
    }

    private Cookie cookie(String name, String value) {
        return new Cookie(name, value).setDomain(".naver.com");
    }
}
