package com.example.devnote.poll.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

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
