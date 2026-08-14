package com.example.devnote.document.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.document.dto.*;
import com.example.devnote.document.service.DocumentService;
import com.example.devnote.member.service.CurrentMemberProvider;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
@Validated
public class DocumentController {
    private final DocumentService documentService;
    private final CurrentMemberProvider currentMemberProvider;

    @Operation(summary = "문서 생성")
    @PostMapping
    public ResponseEntity<ApiResponse<DocumentDetailResponse>> createDocument(
        @Valid @RequestBody DocumentCreateRequest documentCreateRequest,
        HttpServletRequest servletRequest
    ) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        DocumentDetailResponse response = documentService.createDocument(documentCreateRequest, memberId, DocumentScope.PRACTICE);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @Operation(summary = "문서 목록 검색")
    @GetMapping
    public ApiResponse<PageResponse<DocumentListItemResponse>> getDocumentList(
        @Valid @ModelAttribute DocumentSearchCondition documentSearchCondition
    ) {
        documentSearchCondition.setDocumentScope(DocumentScope.PRACTICE);
        return ApiResponse.success(documentService.getDocumentList(documentSearchCondition));
    }

    @Operation(summary = "문서 단일 조회")
    @GetMapping("/{documentId}")
    public ApiResponse<DocumentDetailResponse> getDocumentDetail(@PathVariable Long documentId) {
        return ApiResponse.success(documentService.getDocumentDetail(documentId, DocumentScope.PRACTICE));
    }

    @Operation(summary = "문서 수정")
    @PutMapping("/{documentId}")
    public ApiResponse<DocumentDetailResponse> updateDocument(
        @PathVariable Long documentId,
        @Valid @RequestBody DocumentUpdateRequest documentUpdateRequest,
        HttpServletRequest servletRequest
    ) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        return ApiResponse.success(documentService.updateDocument(documentId, documentUpdateRequest, memberId, DocumentScope.PRACTICE));
    }

    @Operation(summary = "문서 소프트 삭제")
    @DeleteMapping("/{documentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDocument(@PathVariable Long documentId, HttpServletRequest servletRequest) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        documentService.deleteDocument(documentId, memberId, DocumentScope.PRACTICE);
    }

    @Operation(summary = "삭제 문서 복구")
    @PostMapping("/{documentId}/restore")
    public ApiResponse<Void> restoreDocument(@PathVariable Long documentId, HttpServletRequest servletRequest) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        documentService.restoreDocument(documentId, memberId);
        return ApiResponse.success(null);
    }

    @Operation(summary = "문서 변경 이력 조회")
    @GetMapping("/{documentId}/histories")
    public ApiResponse<List<DocumentHistoryResponse>> getDocumentHistories(@PathVariable Long documentId) {
        return ApiResponse.success(documentService.getDocumentHistories(documentId));
    }
}
