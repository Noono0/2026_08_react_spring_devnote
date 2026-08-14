package com.example.devnote.admin.controller;

import com.example.devnote.admin.service.VisitorTrackingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

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
