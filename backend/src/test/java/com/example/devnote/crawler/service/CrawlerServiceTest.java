package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
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

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CrawlerServiceTest {
    @Test
    void collectionStepOverridesOnlyItsOwnSelectorAndFields() throws Exception {
        var step = new com.example.devnote.crawler.dto.CrawlerScenarioStep(
            com.example.devnote.crawler.dto.CrawlerStepType.COLLECT,
            com.example.devnote.crawler.dto.CrawlerTargetMode.SELECTOR, ".product", null, null, "", "", null, List.of(field("가격")));
        CrawlerRunRequest original = request(List.of(field("제목")));
        CrawlerRunRequest effective = original.forCollectionStep(step);
        assertThat(effective.itemSelector()).isEqualTo(".product");
        assertThat(effective.fields()).extracting(CrawlerFieldRequest::name).containsExactly("가격");
        assertThat(effective.maxPages()).isEqualTo(original.maxPages());
        assertThat(original.fields()).extracting(CrawlerFieldRequest::name).containsExactly("제목");
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        assertThat(mapper.readValue(mapper.writeValueAsString(step), com.example.devnote.crawler.dto.CrawlerScenarioStep.class)).isEqualTo(step);
        var legacy = mapper.readValue("{\"type\":\"COLLECT\"}", com.example.devnote.crawler.dto.CrawlerScenarioStep.class);
        assertThat(original.forCollectionStep(legacy).fields()).isEqualTo(original.fields());
    }
    @Test
    void delegatesValidRequestToCrawlerEngine() {
        CrawlerRunResponse expected = new CrawlerRunResponse(
            Instant.parse("2026-09-20T00:00:00Z"), "Example", "https://example.com", 1, 10, 100,
            List.of("제목"), List.of(), List.of()
        );
        CrawlerService service = new CrawlerService(request -> expected);

        assertThat(service.run(request(List.of(field("제목"))))).isSameAs(expected);
    }

    @Test
    void rejectsDuplicateFieldNamesIgnoringCase() {
        CrawlerService service = new CrawlerService(request -> null);

        assertThatThrownBy(() -> service.run(request(List.of(field("Title"), field("title")))))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("서로 달라야");
    }

    @Test
    void omitsCredentialsFromRequestLogRepresentation() {
        CrawlerRunRequest request = request(List.of(field("제목")));

        assertThat(request.toString())
            .doesNotContain("private-user", "private-password")
            .contains("credentials=<omitted>");
    }

    private CrawlerRunRequest request(List<CrawlerFieldRequest> fields) {
        return new CrawlerRunRequest(
            true,
            "https://example.com/list",
            new CrawlerLoginRequest(
                CrawlerLoginMode.FORM,
                "https://example.com/login",
                "private-user",
                "private-password",
                "#username",
                "#password",
                "button[type=submit]",
                ".profile"
            ),
            new CrawlerPageSearchRequest(false, "", "", ""),
            "",
            ".item",
            fields,
            new CrawlerCollectionFilterRequest(CrawlerMatchMode.ALL, List.of()),
            ".next",
            2,
            500,
            100
        );
    }

    private CrawlerFieldRequest field(String name) {
        return new CrawlerFieldRequest(name, ".title", CrawlerValueSource.TEXT, "");
    }
}
