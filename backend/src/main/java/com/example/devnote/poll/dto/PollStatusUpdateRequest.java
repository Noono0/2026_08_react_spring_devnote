package com.example.devnote.poll.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record PollStatusUpdateRequest(@NotNull @Pattern(regexp = "CLOSED|RESULTS_PUBLISHED") String status) {}
