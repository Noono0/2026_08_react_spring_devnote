package com.example.devnote.admin.controller;

import com.example.devnote.admin.service.VisitorTrackingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * 방문 기록 API입니다. 프론트가 화면(경로)을 옮길 때마다 POST /api/v1/visits?path=/portfolio 처럼 호출한다.
 * 로그인하지 않은 방문자도 기록되며, 응답 본문이 필요 없어 204 No Content로 답한다.
 * @RequestParam @NotBlank: path 쿼리 값이 없거나 비어 있으면 400.
 */
@RestController
@RequestMapping("/api/v1/visits")
@RequiredArgsConstructor
public class VisitorTrackingController {
    private final VisitorTrackingService visitorTrackingService;

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void record(@RequestParam @NotBlank String path, HttpServletRequest request) {
        visitorTrackingService.record(path, request);
    }
}
