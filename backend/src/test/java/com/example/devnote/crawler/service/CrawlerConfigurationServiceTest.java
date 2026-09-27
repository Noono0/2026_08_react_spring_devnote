package com.example.devnote.crawler.service;

import com.example.devnote.crawler.dao.CrawlerConfigurationDao;
import com.example.devnote.crawler.dao.parameter.CrawlerRunHistoryCreateParameter;
import com.example.devnote.crawler.dao.row.CrawlerConfigurationRow;
import com.example.devnote.crawler.dto.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CrawlerConfigurationServiceTest {
    @Mock private CrawlerConfigurationDao dao;
    @Mock private CrawlerService crawlerService;
    private CrawlerConfigurationService service;

    @BeforeEach
    void setUp() {
        service = new CrawlerConfigurationService(dao, crawlerService, new ObjectMapper().findAndRegisterModules());
    }

    @Test
    void storesRunHistoryWithoutCredentialsAndCompletesSuccess() {
        CrawlerConfigurationRow configuration = new CrawlerConfigurationRow();
        configuration.setCrawlerConfigurationId(3L);
        when(dao.selectConfiguration(3L)).thenReturn(configuration);
        doAnswer(invocation -> {
            invocation.getArgument(0, CrawlerRunHistoryCreateParameter.class).setCrawlerRunHistoryId(9L);
            return null;
        }).when(dao).insertRunHistory(any());
        CrawlerRunResponse result = new CrawlerRunResponse(
            Instant.parse("2026-09-20T00:00:00Z"), "결과", "https://example.com/list", 1, 1, 100,
            List.of("제목"), List.of(Map.of("제목", "매물")), List.of());
        when(crawlerService.run(any())).thenReturn(result);

        CrawlerTrackedRunResponse response = service.run(3L, request());

        ArgumentCaptor<CrawlerRunHistoryCreateParameter> history = ArgumentCaptor.forClass(CrawlerRunHistoryCreateParameter.class);
        verify(dao).insertRunHistory(history.capture());
        assertThat(history.getValue().getRequestJson()).doesNotContain("private-user", "private-password");
        verify(dao).completeRunHistorySuccess(eq(9L), any(), any(Long.class), eq(1));
        assertThat(response.historyId()).isEqualTo(9L);
        assertThat(response.result()).isSameAs(result);
    }

    private CrawlerRunRequest request() {
        return new CrawlerRunRequest(
            true,
            "https://example.com/list",
            new CrawlerLoginRequest(CrawlerLoginMode.FORM, "https://example.com/login", "private-user", "private-password", "#id", "#pw", "button", ""),
            new CrawlerPageSearchRequest(false, "", "", ""), "", ".item",
            List.of(new CrawlerFieldRequest("제목", ".title", CrawlerValueSource.TEXT, "")),
            new CrawlerCollectionFilterRequest(CrawlerMatchMode.ALL, List.of()), "", 1, 100, 20);
    }
}
