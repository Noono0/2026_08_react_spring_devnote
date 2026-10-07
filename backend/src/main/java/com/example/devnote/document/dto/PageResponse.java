package com.example.devnote.document.dto;

import java.util.List;

/**
 * 페이지 단위 목록 응답. 어떤 종류의 목록에도 쓸 수 있도록 제네릭(T)으로 만들었다.
 *   content         : 이번 페이지의 항목들
 *   pageInformation : 페이지 버튼을 그리는 데 필요한 정보(현재 번호, 전체 건수, 전체 페이지 수, 처음/마지막 여부)
 */
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

    /**
     * 목록·전체 건수로 페이지 정보를 계산한다.
     * 전체 페이지 수 = 올림(전체 건수 ÷ 페이지 크기). 예) 45건, 20건씩 → 3페이지.
     * (double)로 바꾸는 이유: 정수끼리 나누면 소수점이 버려져 45/20 = 2가 되기 때문이다.
     * 결과가 0건이면 전체 페이지 0, 첫 페이지이자 마지막 페이지로 본다.
     */
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
