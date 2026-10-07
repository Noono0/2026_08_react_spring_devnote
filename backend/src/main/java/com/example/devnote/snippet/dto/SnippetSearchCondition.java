package com.example.devnote.snippet.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 코드 조각 목록 조건(쿼리 문자열).
 *   status: ACTIVE(보관함) / TRASH(휴지통)   sort: LATEST(최근 수정) / TITLE(제목) / FAVORITE(즐겨찾기 먼저)
 *   language: ALL이면 언어로 거르지 않는다.
 */
@Getter
@Setter
public class SnippetSearchCondition {
    @Min(0)
    private int pageNumber = 0;
    @Min(1) @Max(50)
    private int pageSize = 10;
    @Size(max = 100)
    private String keyword = "";
    @Size(max = 50)
    private String language = "ALL";
    private boolean favoriteOnly;
    @Pattern(regexp = "ACTIVE|TRASH")
    private String status = "ACTIVE";
    @Pattern(regexp = "LATEST|TITLE|FAVORITE")
    private String sort = "LATEST";
    // 쿼리 문자열로 받지 않고 Service가 로그인 회원 번호로 채운다(?memberId=2를 붙여도 덮어쓴다).
    private Long memberId;

    public int getOffset() {
        return pageNumber * pageSize;
    }
}

