package com.example.devnote.utility.regex.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.utility.regex.dto.RegexExecutionRequest;
import com.example.devnote.utility.regex.dto.RegexExecutionResponse;
import com.example.devnote.utility.regex.service.JavaRegexService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Java 정규식 테스트 도구 API입니다. (POST /api/v1/utilities/regex/java)
 * 브라우저(JavaScript)와 Java의 정규식 문법·동작이 조금 달라, 화면에서 "Java로 실행한 결과"를 비교해 볼 수 있게 한다.
 * 로그인 없이 쓸 수 있으므로 서버를 오래 붙잡는 패턴을 막는 장치가 JavaRegexService에 있다.
 */
@RestController
@RequestMapping("/api/v1/utilities/regex")
@RequiredArgsConstructor
public class JavaRegexController {
    private final JavaRegexService regexService;

    @PostMapping("/java")
    public ApiResponse<RegexExecutionResponse> execute(@Valid @RequestBody RegexExecutionRequest request) {
        return ApiResponse.success(regexService.execute(request));
    }
}

