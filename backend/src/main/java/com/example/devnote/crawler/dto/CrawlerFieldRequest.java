package com.example.devnote.crawler.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CrawlerFieldRequest(
    @NotBlank(message = "필드 이름을 입력해 주세요.")
    @Size(max = 40, message = "필드 이름은 40자 이하여야 합니다.")
    @Pattern(regexp = "^(?!_)[\\p{L}\\p{N} _-]+$", message = "필드 이름에는 문자, 숫자, 공백, 밑줄, 하이픈만 사용할 수 있습니다.")
    String name,

    @Size(max = 500, message = "필드 선택자는 500자 이하여야 합니다.")
    String selector,

    @NotNull(message = "값을 읽는 방식을 선택해 주세요.")
    CrawlerValueSource valueSource,

    @Size(max = 100, message = "속성 이름은 100자 이하여야 합니다.")
    String attributeName
) {
    @JsonIgnore
    @AssertTrue(message = "속성 값을 읽으려면 속성 이름을 입력해 주세요.")
    public boolean isAttributeConfigurationValid() {
        return valueSource != CrawlerValueSource.ATTRIBUTE
            || attributeName != null && !attributeName.isBlank();
    }
}
