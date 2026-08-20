package com.example.devnote.diagram.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 목록 조회 조건. 프론트의 URL 쿼리스트링과 1:1로 대응한다.
 * pageNumber 는 0부터 시작한다 (기존 문서 목록과 동일한 규약).
 */
public record DiagramSearchCondition(
    String searchKeyword,
    DiagramType diagramType,
    @Min(0) Integer pageNumber,
    @Min(1) @Max(100) Integer pageSize
) {
    public int resolvedPageNumber() {
        return pageNumber == null ? 0 : pageNumber;
    }

    public int resolvedPageSize() {
        return pageSize == null ? 12 : pageSize;
    }

    public int offset() {
        return resolvedPageNumber() * resolvedPageSize();
    }

    public String resolvedSearchKeyword() {
        return searchKeyword == null ? "" : searchKeyword.trim();
    }
}
