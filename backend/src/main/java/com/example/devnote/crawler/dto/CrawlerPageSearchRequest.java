package com.example.devnote.crawler.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;

/** 사이트 안 검색창에 검색어를 넣고 검색한 뒤 목록을 수집하는 설정. enabled일 때만 검색어가 필요하다. */
public record CrawlerPageSearchRequest(
    boolean enabled,

    @Size(max = 300, message = "사이트 검색어는 300자 이하여야 합니다.")
    String keyword,

    @Size(max = 500, message = "검색 입력칸 선택자는 500자 이하여야 합니다.")
    String inputSelector,

    @Size(max = 500, message = "검색 버튼 선택자는 500자 이하여야 합니다.")
    String submitSelector
) {
    @JsonIgnore
    @AssertTrue(message = "사이트 검색을 사용하려면 검색어를 입력해 주세요.")
    public boolean isConfigurationValid() {
        // 검색 입력칸 선택자는 선택 사항이다. 비우면 크롤러가 화면에서 검색창을 자동으로 찾는다.
        return !enabled || isPresent(keyword);
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
