package com.example.devnote.poll.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/** 상태 변경 요청. 바꿀 수 있는 목표 상태는 CLOSED(마감)와 RESULTS_PUBLISHED(결과 공개)뿐이다(다시 OPEN으로는 못 돌림). */
public record PollStatusUpdateRequest(@NotNull @Pattern(regexp = "CLOSED|RESULTS_PUBLISHED") String status) {}
