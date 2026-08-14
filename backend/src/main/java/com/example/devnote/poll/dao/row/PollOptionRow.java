package com.example.devnote.poll.dao.row;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PollOptionRow {
    private Long pollOptionId;
    private String optionLabel;
    private Integer sortOrder;
    private Long voteCount;
}
