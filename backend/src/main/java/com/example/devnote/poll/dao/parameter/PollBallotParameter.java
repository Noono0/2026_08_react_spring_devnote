package com.example.devnote.poll.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/** 투표지 INSERT용 값. memberId는 비회원이면 null. pollBallotId는 INSERT 후 MyBatis가 채운다(선택 저장에 쓰임). */
@Getter
@Setter
@Builder
public class PollBallotParameter {
    private Long pollBallotId;
    private Long pollId;
    private String visitorKey;
    private Long memberId;
}
