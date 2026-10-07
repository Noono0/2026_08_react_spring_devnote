package com.example.devnote.poll.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 투표 생성·수정용 값. endsAt은 UTC 기준 LocalDateTime으로 저장한다(서버·DB 시간대를 UTC로 통일).
 * pollId는 생성 때 비어 있다가 INSERT 후 채워지고, 수정 때는 대상 번호가 들어 있다.
 */
@Getter
@Setter
@Builder
public class PollCreateParameter {
    private Long pollId;
    private String question;
    private boolean allowMultiple;
    private int maxSelections;
    private boolean realtimeResults;
    private LocalDateTime endsAt;
    private Long createdBy;
}
