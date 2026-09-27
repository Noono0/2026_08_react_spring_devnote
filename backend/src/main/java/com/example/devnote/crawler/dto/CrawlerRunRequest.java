package com.example.devnote.crawler.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CrawlerRunRequest(
    @NotNull(message = "브라우저 화면 표시 여부가 필요합니다.")
    Boolean showBrowser,

    @NotBlank(message = "수집할 URL을 입력해 주세요.")
    @Size(max = 2_000, message = "수집 URL은 2,000자 이하여야 합니다.")
    String startUrl,

    @NotNull(message = "로그인 설정이 필요합니다.")
    @Valid
    CrawlerLoginRequest login,

    @NotNull(message = "사이트 검색 설정이 필요합니다.")
    @Valid
    CrawlerPageSearchRequest pageSearch,

    @Size(max = 500, message = "콘텐츠 iframe 선택자는 500자 이하여야 합니다.")
    String contentFrameSelector,

    /** 비우면 화면에서 가장 큰 표·목록을 자동으로 찾는다. */
    @Size(max = 500, message = "반복 항목 선택자는 500자 이하여야 합니다.")
    String itemSelector,

    /** 비우면 표의 열 제목(제목·작성자·작성일 등)을 필드 이름으로 자동 사용한다. */
    @Size(max = 12, message = "수집 필드는 최대 12개까지 추가할 수 있습니다.")
    List<@Valid CrawlerFieldRequest> fields,

    @NotNull(message = "수집 키워드 설정이 필요합니다.")
    @Valid
    CrawlerCollectionFilterRequest collectionFilter,

    @Size(max = 500, message = "다음 페이지 선택자는 500자 이하여야 합니다.")
    String nextPageSelector,

    @Min(value = 1, message = "수집 페이지 수는 1 이상이어야 합니다.")
    @Max(value = 10, message = "수집 페이지 수는 최대 10입니다.")
    int maxPages,

    @Min(value = 0, message = "대기 시간은 0 이상이어야 합니다.")
    @Max(value = 30_000, message = "페이지 대기 시간은 최대 30초입니다.")
    int waitAfterNavigationMillis,

    @Min(value = 1, message = "수집 항목 수는 1 이상이어야 합니다.")
    @Max(value = 500, message = "수집 항목 수는 최대 500개입니다.")
    int maxItems,

    /** 브라우저 표시 위치. 값이 없던 기존 저장 설정은 웹 화면(WEB)으로 실행한다. */
    CrawlerBrowserWindow browserWindow,

    /**
     * 단계별 실행 목록. 비어 있으면 [LEGACY-FORM] 기존 방식(로그인 설정 → 사이트 검색 → 목록 수집)으로 실행한다.
     * 단계가 있으면 로그인·검색 설정은 쓰지 않고 단계를 순서대로 실행한다(계정정보는 {{username}}, {{password}}로 사용).
     */
    @Size(max = 100, message = "단계는 최대 100개까지 만들 수 있습니다.")
    List<@Valid CrawlerScenarioStep> steps,

    /** true면 목록 수집 뒤 각 항목의 링크를 열어 상세글 본문을 '상세내용'으로 함께 가져온다. */
    boolean collectDetail,

    /** 상세글 본문 선택자. 비우면 본문으로 보이는 영역을 자동으로 찾는다. */
    @Size(max = 500, message = "상세글 본문 선택자는 500자 이하여야 합니다.")
    String detailSelector,

    /** true면 제목(부족하면 상세내용)에서 보증금·월세·방 수·면적·역·도보·층을 뽑아 칸으로 나눈다. */
    boolean parseListing
) {
    public CrawlerRunRequest {
        itemSelector = itemSelector == null ? "" : itemSelector;
        detailSelector = detailSelector == null ? "" : detailSelector;
        fields = fields == null ? List.of() : fields;
        showBrowser = showBrowser == null ? Boolean.TRUE : showBrowser;
        browserWindow = browserWindow == null ? CrawlerBrowserWindow.WEB : browserWindow;
        steps = steps == null ? List.of() : List.copyOf(steps);
    }

    /** 단계 목록 없이 만드는 기존 코드용 생성자. */
    public CrawlerRunRequest(
        Boolean showBrowser, String startUrl, CrawlerLoginRequest login, CrawlerPageSearchRequest pageSearch,
        String contentFrameSelector, String itemSelector, List<CrawlerFieldRequest> fields,
        CrawlerCollectionFilterRequest collectionFilter, String nextPageSelector,
        int maxPages, int waitAfterNavigationMillis, int maxItems, CrawlerBrowserWindow browserWindow
    ) {
        this(showBrowser, startUrl, login, pageSearch, contentFrameSelector, itemSelector, fields,
            collectionFilter, nextPageSelector, maxPages, waitAfterNavigationMillis, maxItems, browserWindow, List.of(), false, "", false);
    }

    public boolean usesSteps() {
        return !steps.isEmpty();
    }

    /** 반복별 대상·추출 설정을 실행 요청으로 옮긴다. 기존 저장 설정은 공통 값을 유지한다. */
    public CrawlerRunRequest forCollectionStep(CrawlerScenarioStep step) {
        return new CrawlerRunRequest(showBrowser, startUrl, login, pageSearch, contentFrameSelector,
            step.target().isBlank() ? itemSelector : step.target(),
            step.fields() == null ? fields : step.fields(), collectionFilter, nextPageSelector,
            maxPages, waitAfterNavigationMillis, maxItems, browserWindow, steps, collectDetail, detailSelector, parseListing);
    }

    /** 브라우저 표시 위치를 지정하지 않는 기존 코드·테스트용 생성자. */
    public CrawlerRunRequest(
        Boolean showBrowser, String startUrl, CrawlerLoginRequest login, CrawlerPageSearchRequest pageSearch,
        String contentFrameSelector, String itemSelector, List<CrawlerFieldRequest> fields,
        CrawlerCollectionFilterRequest collectionFilter, String nextPageSelector,
        int maxPages, int waitAfterNavigationMillis, int maxItems
    ) {
        this(showBrowser, startUrl, login, pageSearch, contentFrameSelector, itemSelector, fields,
            collectionFilter, nextPageSelector, maxPages, waitAfterNavigationMillis, maxItems, CrawlerBrowserWindow.WEB, List.of(), false, "", false);
    }

    public boolean usesPcWindow() {
        return Boolean.TRUE.equals(showBrowser) && browserWindow == CrawlerBrowserWindow.PC_WINDOW;
    }

    @Override
    public String toString() {
        return "CrawlerRunRequest[showBrowser=" + showBrowser
            + ", browserWindow=" + browserWindow
            + ", stepCount=" + steps.size()
            + ", collectDetail=" + collectDetail
            + ", parseListing=" + parseListing
            + ", startUrl=" + startUrl
            + ", login=" + login
            + ", pageSearchEnabled=" + (pageSearch != null && pageSearch.enabled())
            + ", contentFrame=" + (contentFrameSelector == null || contentFrameSelector.isBlank() ? "main" : "configured")
            + ", itemSelector=" + itemSelector
            + ", fieldCount=" + (fields == null ? 0 : fields.size())
            + ", keywordGroupCount=" + (collectionFilter == null || collectionFilter.groups() == null
                ? 0 : collectionFilter.groups().size())
            + ", maxPages=" + maxPages
            + ", maxItems=" + maxItems + "]";
    }
}
