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

/**
 * React 연습장의 문서 CRUD API입니다. (/api/v1/documents, 범위 PRACTICE)
 *
 * [요청 흐름] Controller → DocumentService → DocumentDao → DocumentMapper.xml → MySQL
 *   Controller가 하는 일: ① 주소·메서드 연결 ② 입력 검증(@Valid) ③ 현재 회원 확인 ④ Service 호출 ⑤ ApiResponse로 감싸기
 *   "작성자만 수정 가능", "버전 충돌" 같은 업무 규칙은 Service가 판단한다.
 *
 * @RestController   : 메서드가 돌려준 객체를 JSON으로 바꿔 응답 본문에 쓴다.
 * @RequiredArgsConstructor: final 필드를 받는 생성자를 Lombok이 만들고, Spring이 그 생성자로 Service를 넣어 준다(생성자 주입).
 * @Validated        : @PathVariable 등 메서드 파라미터 검증도 켠다.
 * @Operation        : Swagger UI에 보일 API 설명.
 */
@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
@Validated
public class DocumentController {
    private final DocumentService documentService;
    private final CurrentMemberProvider currentMemberProvider;

    @Operation(summary = "문서 생성")
    // POST /api/v1/documents → 201 Created. 작성자는 요청 본문이 아니라 서버가 정한 현재 회원으로 저장한다(남의 이름으로 쓰기 방지).
    @PostMapping
    public ResponseEntity<ApiResponse<DocumentDetailResponse>> createDocument(
        @Valid @RequestBody DocumentCreateRequest documentCreateRequest,
        HttpServletRequest servletRequest
    ) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        DocumentDetailResponse response = documentService.createDocument(documentCreateRequest, memberId, DocumentScope.PRACTICE);
        // ResponseEntity: 본문뿐 아니라 HTTP 상태 코드(201)까지 직접 정할 때 쓴다.
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @Operation(summary = "문서 목록 검색")
    // GET /api/v1/documents?searchKeyword=react&pageNumber=1&pageSize=10&sortProperty=UPDATED_AT …
    // @ModelAttribute: 쿼리 문자열의 각 값을 DocumentSearchCondition 객체의 같은 이름 필드에 채운다.
    @GetMapping
    public ApiResponse<PageResponse<DocumentListItemResponse>> getDocumentList(
        @Valid @ModelAttribute DocumentSearchCondition documentSearchCondition
    ) {
        // 범위는 사용자가 바꿀 수 없게 서버가 고정한다(연습장 API로 업무 History 글을 조회하지 못하게).
        documentSearchCondition.setDocumentScope(DocumentScope.PRACTICE);
        return ApiResponse.success(documentService.getDocumentList(documentSearchCondition));
    }

    @Operation(summary = "문서 단일 조회")
    // GET /api/v1/documents/1 → {documentId} 자리의 1이 @PathVariable Long documentId로 들어온다. 숫자가 아니면 400.
    @GetMapping("/{documentId}")
    public ApiResponse<DocumentDetailResponse> getDocumentDetail(@PathVariable Long documentId) {
        return ApiResponse.success(documentService.getDocumentDetail(documentId, DocumentScope.PRACTICE));
    }

    @Operation(summary = "문서 수정")
    // PUT /api/v1/documents/1 → 본문의 versionNumber가 DB의 현재 버전과 다르면 409(다른 곳에서 먼저 수정됨).
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
    // DELETE /api/v1/documents/1 → 204 No Content(돌려줄 본문 없음). 행을 지우지 않고 use_yn='N'으로 표시만 한다(소프트 삭제).
    @DeleteMapping("/{documentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDocument(@PathVariable Long documentId, HttpServletRequest servletRequest) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        documentService.deleteDocument(documentId, memberId, DocumentScope.PRACTICE);
    }

    @Operation(summary = "삭제 문서 복구")
    // POST /api/v1/documents/1/restore → 소프트 삭제한 문서를 되살린다. "동작"을 나타내는 주소라 POST를 쓴다.
    @PostMapping("/{documentId}/restore")
    public ApiResponse<Void> restoreDocument(@PathVariable Long documentId, HttpServletRequest servletRequest) {
        Long memberId = currentMemberProvider.getCurrentMemberId(servletRequest);
        documentService.restoreDocument(documentId, memberId);
        return ApiResponse.success(null);
    }

    @Operation(summary = "문서 변경 이력 조회")
    // GET /api/v1/documents/1/histories → 수정할 때마다 쌓인 이전 버전 목록(최신 버전부터).
    @GetMapping("/{documentId}/histories")
    public ApiResponse<List<DocumentHistoryResponse>> getDocumentHistories(@PathVariable Long documentId) {
        return ApiResponse.success(documentService.getDocumentHistories(documentId));
    }
}
