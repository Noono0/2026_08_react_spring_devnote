package com.example.devnote.crawler.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 로그인 설정. FORM 방식일 때만 URL·계정·선택자가 모두 필요하다(isFormConfigurationValid).
 * ★ username·password는 실행할 때만 쓰고 DB에는 저장하지 않는다(CrawlerConfigurationService.withoutCredentials).
 * toString을 직접 만든 이유: 기본 toString은 모든 값을 찍어 로그(MethodLoggingAspect)에 비밀번호가 남을 수 있다.
 */
public record CrawlerLoginRequest(
    @NotNull(message = "로그인 방식을 선택해 주세요.")
    CrawlerLoginMode mode,

    @Size(max = 2_000, message = "로그인 URL은 2,000자 이하여야 합니다.")
    String loginUrl,

    @Size(max = 300, message = "로그인 아이디는 300자 이하여야 합니다.")
    String username,

    @Size(max = 1_000, message = "로그인 비밀번호가 너무 깁니다.")
    String password,

    @Size(max = 500, message = "아이디 선택자는 500자 이하여야 합니다.")
    String usernameSelector,

    @Size(max = 500, message = "비밀번호 선택자는 500자 이하여야 합니다.")
    String passwordSelector,

    @Size(max = 500, message = "로그인 버튼 선택자는 500자 이하여야 합니다.")
    String submitSelector,

    @Size(max = 500, message = "로그인 완료 선택자는 500자 이하여야 합니다.")
    String loggedInSelector
) {
    @JsonIgnore
    @AssertTrue(message = "폼 로그인에 필요한 URL, 계정정보, 선택자를 모두 입력해 주세요.")
    public boolean isFormConfigurationValid() {
        if (mode != CrawlerLoginMode.FORM) return true;
        return isPresent(loginUrl)
            && isPresent(username)
            && isPresent(password)
            && isPresent(usernameSelector)
            && isPresent(passwordSelector)
            && isPresent(submitSelector);
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    @Override
    public String toString() {
        return "CrawlerLoginRequest[mode=" + mode + ", credentials=<omitted>, selectors=<omitted>]";
    }
}
