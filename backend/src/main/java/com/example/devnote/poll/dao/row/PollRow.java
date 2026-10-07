package com.example.devnote.poll.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * polls 한 행 + 만든 사람 이름(JOIN).
 * pollStatus는 DB에 저장된 값이다. OPEN이어도 마감 시각이 지났으면 Service가 CLOSED로 계산해 응답한다.
 */
@Getter
@Setter
public class PollRow {
    private Long pollId;
    private String question;
    private String pollStatus;
    private Boolean allowMultiple;
    private Integer maxSelections;
    private Boolean realtimeResults;
    private LocalDateTime endsAt;
    private LocalDateTime resultPublishedAt;
    private Long createdBy;
    private String creatorName;
    private LocalDateTime createdAt;
}
