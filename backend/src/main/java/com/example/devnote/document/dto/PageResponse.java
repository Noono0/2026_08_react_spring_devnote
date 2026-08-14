package com.example.devnote.document.dto;

import java.util.List;

public record PageResponse<T>(
    List<T> content,
    PageInformation pageInformation
) {
    public record PageInformation(
        int pageNumber,
        int pageSize,
        long totalElements,
        int totalPages,
        boolean firstPage,
        boolean lastPage
    ) {
    }

    public static <T> PageResponse<T> of(List<T> content, int pageNumber, int pageSize, long totalElements) {
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / pageSize);
        return new PageResponse<>(
            content,
            new PageInformation(
                pageNumber,
                pageSize,
                totalElements,
                totalPages,
                pageNumber == 0,
                totalPages == 0 || pageNumber >= totalPages - 1
            )
        );
    }
}
