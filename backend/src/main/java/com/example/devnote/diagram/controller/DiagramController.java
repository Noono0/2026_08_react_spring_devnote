package com.example.devnote.diagram.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.diagram.dto.DiagramDetailResponse;
import com.example.devnote.diagram.dto.DiagramListItemResponse;
import com.example.devnote.diagram.dto.DiagramSaveRequest;
import com.example.devnote.diagram.dto.DiagramSearchCondition;
import com.example.devnote.diagram.dto.DiagramVersionResponse;
import com.example.devnote.diagram.service.DiagramService;
import com.example.devnote.document.dto.PageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 다이어그램 API.
 *
 * 모든 조회/수정은 세션의 현재 회원을 기준으로 소유권을 검증한다.
 * (검증은 서비스 계층의 findOwnedDiagram 에서 일괄 수행한다)
 */
@RestController
@RequestMapping("/api/v1/diagrams")
@RequiredArgsConstructor
public class DiagramController {
    private final DiagramService diagramService;

    @GetMapping
    public ApiResponse<PageResponse<DiagramListItemResponse>> getDiagrams(
        @Valid DiagramSearchCondition condition, HttpServletRequest request) {
        return ApiResponse.success(diagramService.getDiagrams(condition, request));
    }

    @GetMapping("/{diagramId}")
    public ApiResponse<DiagramDetailResponse> getDiagram(
        @PathVariable Long diagramId, HttpServletRequest request) {
        return ApiResponse.success(diagramService.getDiagram(diagramId, request));
    }

    @PostMapping
    public ApiResponse<DiagramDetailResponse> create(
        @Valid @RequestBody DiagramSaveRequest saveRequest, HttpServletRequest request) {
        return ApiResponse.created(diagramService.create(saveRequest, request));
    }

    @PutMapping("/{diagramId}")
    public ApiResponse<DiagramDetailResponse> update(
        @PathVariable Long diagramId, @Valid @RequestBody DiagramSaveRequest saveRequest, HttpServletRequest request) {
        return ApiResponse.success(diagramService.update(diagramId, saveRequest, request));
    }

    @DeleteMapping("/{diagramId}")
    public ApiResponse<Void> delete(@PathVariable Long diagramId, HttpServletRequest request) {
        diagramService.delete(diagramId, request);
        return ApiResponse.success(null);
    }

    @GetMapping("/{diagramId}/versions")
    public ApiResponse<List<DiagramVersionResponse>> getVersions(
        @PathVariable Long diagramId, HttpServletRequest request) {
        return ApiResponse.success(diagramService.getVersions(diagramId, request));
    }

    @GetMapping("/{diagramId}/versions/{versionNumber}")
    public ApiResponse<DiagramVersionResponse> getVersion(
        @PathVariable Long diagramId, @PathVariable Long versionNumber, HttpServletRequest request) {
        return ApiResponse.success(diagramService.getVersion(diagramId, versionNumber, request));
    }

    /**
     * 이전 버전으로 되돌린다.
     * 되돌리기도 하나의 "저장"이므로 POST 로 두고, 새 버전이 만들어진다.
     */
    @PostMapping("/{diagramId}/versions/{versionNumber}/restore")
    public ApiResponse<DiagramDetailResponse> restoreVersion(
        @PathVariable Long diagramId, @PathVariable Long versionNumber, HttpServletRequest request) {
        return ApiResponse.success(diagramService.restoreVersion(diagramId, versionNumber, request));
    }
}
