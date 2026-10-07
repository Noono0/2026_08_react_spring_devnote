package com.example.devnote.crawler.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 수집할 값 하나(결과 표의 열 하나).
 *   name         : 열 이름. 정규식으로 문자(\p{L})·숫자(\p{N})·공백·_·-만 허용하고 _로 시작할 수 없다(내부 예약 이름과 겹치지 않게).
 *   selector     : 항목 안에서 값을 찾을 CSS 선택자
 *   valueSource  : TEXT(보이는 글자) 또는 ATTRIBUTE(href 같은 속성 값)
 *   attributeName: ATTRIBUTE일 때 읽을 속성 이름
 */
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
    // @AssertTrue: 여러 칸을 함께 봐야 하는 검사를 메서드로 만든다(이름이 is로 시작해야 검증기가 찾는다).
    // @JsonIgnore: 이 메서드가 JSON 응답에 attributeConfigurationValid 필드로 나가지 않게 한다.
    @JsonIgnore
    @AssertTrue(message = "속성 값을 읽으려면 속성 이름을 입력해 주세요.")
    public boolean isAttributeConfigurationValid() {
        return valueSource != CrawlerValueSource.ATTRIBUTE
            || attributeName != null && !attributeName.isBlank();
    }
}
