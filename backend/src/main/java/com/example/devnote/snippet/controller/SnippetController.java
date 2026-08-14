package com.example.devnote.snippet.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.snippet.dto.*;
import com.example.devnote.snippet.service.SnippetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/snippets")
@RequiredArgsConstructor
public class SnippetController {
    private final SnippetService snippetService;

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

    @PostMapping("/bulk-delete")
    public ApiResponse<Integer> bulkDelete(@Valid @RequestBody SnippetBulkRequest bulkRequest, HttpServletRequest request) {
        return ApiResponse.success(snippetService.bulkDelete(bulkRequest, request));
    }

    @PostMapping("/bulk-restore")
    public ApiResponse<Integer> bulkRestore(@Valid @RequestBody SnippetBulkRequest bulkRequest, HttpServletRequest request) {
        return ApiResponse.success(snippetService.bulkRestore(bulkRequest, request));
    }
}

