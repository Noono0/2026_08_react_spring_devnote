package com.example.devnote.snippet.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.snippet.dto.*;
import com.example.devnote.snippet.service.SnippetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 개인 코드 조각(Snippet) 보관함 API입니다. (/api/v1/snippets)
 *
 * 로그인한 회원만 쓸 수 있고, 각자 "자기 코드 조각"만 보고 고칠 수 있다(SnippetService가 회원 번호로 거른다).
 * 삭제는 휴지통으로 옮기는 소프트 삭제이며, restore로 되살린다. 여러 개를 한 번에 처리하는 bulk API도 있다.
 */
@RestController
@RequestMapping("/api/v1/snippets")
@RequiredArgsConstructor
public class SnippetController {
    private final SnippetService snippetService;

    // GET /api/v1/snippets?keyword=fetch&language=TypeScript&status=TRASH&sort=TITLE
    @GetMapping
    public ApiResponse<PageResponse<SnippetResponse>> getSnippets(@Valid SnippetSearchCondition condition, HttpServletRequest request) {
        return ApiResponse.success(snippetService.getSnippets(condition, request));
    }

    @GetMapping("/{snippetId}")
    public ApiResponse<SnippetResponse> getSnippet(@PathVariable Long snippetId, HttpServletRequest request) {
        return ApiResponse.success(snippetService.getSnippet(snippetId, request));
    }

    @PostMapping
    public ApiResponse<SnippetResponse> create(@Valid @RequestBody SnippetSaveRequest saveRequest, HttpServletRequest request) {
        return ApiResponse.created(snippetService.create(saveRequest, request));
    }

    @PutMapping("/{snippetId}")
    public ApiResponse<SnippetResponse> update(@PathVariable Long snippetId, @Valid @RequestBody SnippetSaveRequest saveRequest, HttpServletRequest request) {
        return ApiResponse.success(snippetService.update(snippetId, saveRequest, request));
    }

    @DeleteMapping("/{snippetId}")
    public ApiResponse<Void> delete(@PathVariable Long snippetId, HttpServletRequest request) {
        snippetService.delete(snippetId, request);
        return ApiResponse.success(null);
    }

    @PostMapping("/{snippetId}/restore")
    public ApiResponse<SnippetResponse> restore(@PathVariable Long snippetId, HttpServletRequest request) {
        return ApiResponse.success(snippetService.restore(snippetId, request));
    }

    // 여러 개를 한 번에 휴지통으로. 실제로 처리된 개수를 돌려준다(남의 것이거나 이미 지운 것은 세지 않는다).
    // 본문에 번호 목록을 담아야 해서 DELETE 대신 POST를 쓴다.
    @PostMapping("/bulk-delete")
    public ApiResponse<Integer> bulkDelete(@Valid @RequestBody SnippetBulkRequest bulkRequest, HttpServletRequest request) {
        return ApiResponse.success(snippetService.bulkDelete(bulkRequest, request));
    }

    @PostMapping("/bulk-restore")
    public ApiResponse<Integer> bulkRestore(@Valid @RequestBody SnippetBulkRequest bulkRequest, HttpServletRequest request) {
        return ApiResponse.success(snippetService.bulkRestore(bulkRequest, request));
    }
}

