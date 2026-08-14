package com.example.devnote.snippet.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

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
    private Long memberId;

    public int getOffset() {
        return pageNumber * pageSize;
    }
}

