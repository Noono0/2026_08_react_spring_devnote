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

import java.util.List;

/**
 * 포트폴리오의 "업무 History" 게시판 API입니다. (/api/v1/history, 범위 HISTORY)
 *
 * 문서 테이블과 DocumentService를 연습장과 함께 쓰고, 범위(DocumentScope)만 HISTORY로 나눈다.
 *
 * [권한 규칙]
 *   읽기: 누구나. 단, 슈퍼관리자가 아니면 공개(PUBLISHED) 글만 보인다(DRAFT·ARCHIVED는 숨김).
 *   쓰기·수정·삭제: 로그인한 슈퍼관리자만(requireSuperAdministrator).
 *   ★ 화면에서 버튼을 숨기는 것과 별개로, 서버에서도 반드시 다시 검사한다.
 */
@RestController
@RequestMapping("/api/v1/history")
@RequiredArgsConstructor
@Validated
public class HistoryController {
    // History 게시판의 주인 = 1번 회원(슈퍼관리자). 다른 회원이 쓴 HISTORY 글이 있더라도 목록에 섞이지 않게 작성자를 고정한다.
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
        // 방문자가 ?documentStatus=DRAFT를 붙여 보내도 여기서 PUBLISHED로 덮어쓴다(요청 값을 믿지 않는다).
        if (!isSuperAdministrator(request)) condition.setDocumentStatus(DocumentStatus.PUBLISHED);
        return ApiResponse.success(documentService.getDocumentList(condition));
    }

    /** 태그 필터 버튼용. 방문자에게는 공개(PUBLISHED) 글의 태그만 보여 준다. */
    @GetMapping("/tags")
    public ApiResponse<List<DocumentTagCountResponse>> getHistoryTags(HttpServletRequest request) {
        DocumentStatus visibleStatus = isSuperAdministrator(request) ? null : DocumentStatus.PUBLISHED;
        return ApiResponse.success(documentService.getPopularTags(DocumentScope.HISTORY, HISTORY_OWNER_MEMBER_ID, visibleStatus));
    }

    @GetMapping("/{documentId}")
    public ApiResponse<DocumentDetailResponse> getHistoryDetail(@PathVariable Long documentId, HttpServletRequest request) {
        DocumentDetailResponse document = documentService.getDocumentDetail(documentId, DocumentScope.HISTORY);
        // 주인 글이 아니거나, 방문자가 비공개 글을 열려고 하면 403이 아니라 404로 답한다.
        // "그런 글이 있다"는 사실조차 알려 주지 않기 위해서다.
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

    /** 로그인한 슈퍼관리자인가? (읽기 화면에서 비공개 글까지 보여 줄지 정할 때) */
    private boolean isSuperAdministrator(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        return member != null && "SUPER_ADMIN".equals(member.getMemberRole());
    }

    /** 슈퍼관리자가 아니면 403 예외를 던지고, 맞으면 그 회원을 돌려준다(작성자 번호로 쓰기 위해). */
    private MemberRow requireSuperAdministrator(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        if (member == null || !"SUPER_ADMIN".equals(member.getMemberRole())) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "슈퍼관리자만 업무 History를 편집할 수 있습니다.");
        }
        return member;
    }
}
