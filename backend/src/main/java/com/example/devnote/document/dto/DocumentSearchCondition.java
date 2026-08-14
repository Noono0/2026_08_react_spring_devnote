package com.example.devnote.document.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@ToString
public class DocumentSearchCondition {
    private String searchKeyword = "";
    private String searchType = "TITLE_CONTENT";
    private DocumentStatus documentStatus;
    private DocumentScope documentScope;
    private Long authorId;

    @Min(value = 0, message = "페이지 번호는 0 이상이어야 합니다.")
    private int pageNumber = 0;

    @Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
    @Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.")
    private int pageSize = 20;

    private String sortProperty = "UPDATED_AT";
    private String sortDirection = "DESC";

    public int getOffset() {
        return pageNumber * pageSize;
    }
}
