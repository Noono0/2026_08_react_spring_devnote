package com.example.devnote.poll.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class PollBallotParameter {
    private Long pollBallotId;
    private Long pollId;
    private String visitorKey;
    private Long memberId;
}
