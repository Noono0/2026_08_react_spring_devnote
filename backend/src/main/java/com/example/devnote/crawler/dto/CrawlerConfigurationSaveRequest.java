package com.example.devnote.crawler.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 크롤러 설정 저장 요청. request 안쪽 객체까지 검증하려면 @Valid를 붙여야 한다
 * (붙이지 않으면 바깥 필드만 검사하고 CrawlerRunRequest 안의 @NotBlank 등은 무시된다).
 */
public record CrawlerConfigurationSaveRequest(
    @NotBlank(message = "설정 제목을 입력해 주세요.")
    @Size(max = 120, message = "설정 제목은 120자 이하여야 합니다.")
    String title,

    @Size(max = 1_000, message = "설명은 1,000자 이하여야 합니다.")
    String description,

    @NotNull(message = "사이트 프리셋을 선택해 주세요.")
    CrawlerSitePreset sitePreset,

    @NotNull(message = "크롤링 요청 설정이 필요합니다.")
    @Valid
    CrawlerRunRequest request
) {
}
