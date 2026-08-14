package com.example.devnote.document.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dto.*;
import com.example.devnote.document.service.DocumentService;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/history")
@RequiredArgsConstructor
@Validated
public class HistoryController {
    private static final long HISTORY_OWNER_MEMBER_ID = 1L;
    private final DocumentService documentService;
    private final AuthenticationService authenticationService;

    @GetMapping
    public ApiResponse<PageResponse<DocumentListItemResponse>> getHistory(
        @Valid @ModelAttribute DocumentSearchCondition condition,
        HttpServletRequest request
    ) {
        condition.setAuthorId(HISTORY_OWNER_MEMBER_ID);
        condition.setDocumentScope(DocumentScope.HISTORY);
        if (!isSuperAdministrator(request)) condition.setDocumentStatus(DocumentStatus.PUBLISHED);
        return ApiResponse.success(documentService.getDocumentList(condition));
    }

    @GetMapping("/{documentId}")
    public ApiResponse<DocumentDetailResponse> getHistoryDetail(@PathVariable Long documentId, HttpServletRequest request) {
        DocumentDetailResponse document = documentService.getDocumentDetail(documentId, DocumentScope.HISTORY);
        if (document.authorId() == null || document.authorId() != HISTORY_OWNER_MEMBER_ID
            || (!isSuperAdministrator(request) && !DocumentStatus.PUBLISHED.name().equals(document.documentStatus()))) {
            throw new BusinessException(ErrorCode.DOCUMENT_NOT_FOUND);
        }
        return ApiResponse.success(document);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DocumentDetailResponse>> createHistory(
        @Valid @RequestBody DocumentCreateRequest createRequest,
        HttpServletRequest request
    ) {
        MemberRow superAdministrator = requireSuperAdministrator(request);
        DocumentDetailResponse created = documentService.createDocument(createRequest, superAdministrator.getMemberId(), DocumentScope.HISTORY);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(created));
    }

    @PutMapping("/{documentId}")
    public ApiResponse<DocumentDetailResponse> updateHistory(
        @PathVariable Long documentId,
        @Valid @RequestBody DocumentUpdateRequest updateRequest,
        HttpServletRequest request
    ) {
        MemberRow superAdministrator = requireSuperAdministrator(request);
        return ApiResponse.success(documentService.updateDocument(documentId, updateRequest, superAdministrator.getMemberId(), DocumentScope.HISTORY));
    }

    @DeleteMapping("/{documentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHistory(@PathVariable Long documentId, HttpServletRequest request) {
        MemberRow superAdministrator = requireSuperAdministrator(request);
        documentService.deleteDocument(documentId, superAdministrator.getMemberId(), DocumentScope.HISTORY);
    }

    private boolean isSuperAdministrator(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        return member != null && "SUPER_ADMIN".equals(member.getMemberRole());
    }

    private MemberRow requireSuperAdministrator(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        if (member == null || !"SUPER_ADMIN".equals(member.getMemberRole())) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "슈퍼관리자만 업무 History를 편집할 수 있습니다.");
        }
        return member;
    }
}
