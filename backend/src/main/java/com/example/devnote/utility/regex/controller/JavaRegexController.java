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

