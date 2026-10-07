package com.example.devnote.poll.dao.row;

import lombok.Getter;
import lombok.Setter;

/** 선택지 한 줄과 그 선택지를 고른 수(voteCount, SQL의 COUNT로 계산). */
@Getter
@Setter
public class PollOptionRow {
    private Long pollOptionId;
    private String optionLabel;
    private Integer sortOrder;
    private Long voteCount;
}
