package com.example.devnote.poll.dto;

import java.time.Instant;
import java.util.List;

public record PollResponse(
    Long pollId,
    String question,
    String status,
    List<PollOptionResponse> options,
    Long totalSelections,
    long participantCount,
    boolean participated,
    List<Long> selectedOptionIds,
    boolean allowMultiple,
    int maxSelections,
    boolean realtimeResults,
    boolean resultsVisible,
    boolean manageableByCurrentUser,
    boolean deletableByCurrentUser,
    Long createdBy,
    String creatorName,
    Instant endsAt,
    Instant resultPublishedAt,
    Instant createdAt
) {}
