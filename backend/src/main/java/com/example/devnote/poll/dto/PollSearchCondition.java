package com.example.devnote.poll.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PollSearchCondition {
    @Min(0)
    private int pageNumber = 0;

    @Min(1)
    @Max(50)
    private int pageSize = 10;

    @Pattern(regexp = "ALL|OPEN|CLOSED|RESULTS_PUBLISHED")
    private String status = "ALL";

    public int getOffset() {
        return pageNumber * pageSize;
    }
}
