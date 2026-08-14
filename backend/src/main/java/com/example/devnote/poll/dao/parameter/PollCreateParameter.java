package com.example.devnote.poll.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

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
