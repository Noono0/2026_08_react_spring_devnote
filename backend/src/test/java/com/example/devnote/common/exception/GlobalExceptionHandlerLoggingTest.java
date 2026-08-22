package com.example.devnote.common.exception;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerLoggingTest {

    @Test
    void validationLogContainsFieldAndReasonWithoutRejectedValue(CapturedOutput output) {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "request");
        bindingResult.addError(new FieldError(
            "request",
            "contentText",
            "",
            false,
            null,
            null,
            "검색용 텍스트는 필수입니다."
        ));
        bindingResult.addError(new FieldError(
            "request",
            "password",
            "do-not-log-this-password",
            false,
            null,
            null,
            "비밀번호 형식을 확인해 주세요."
        ));
        MethodArgumentNotValidException exception = new MethodArgumentNotValidException(null, bindingResult);
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/documents/3");

        new GlobalExceptionHandler().handleValidationException(exception, request);

        assertThat(output)
            .contains("[ValidationException]")
            .contains("method=PUT")
            .contains("uri=/api/v1/documents/3")
            .contains("contentText=검색용 텍스트는 필수입니다.")
            .contains("password=비밀번호 형식을 확인해 주세요.")
            .doesNotContain("do-not-log-this-password");
    }
}
