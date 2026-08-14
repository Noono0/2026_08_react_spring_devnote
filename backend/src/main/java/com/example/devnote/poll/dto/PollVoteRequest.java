package com.example.devnote.poll.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record PollVoteRequest(
    @NotNull @Size(min = 1, max = 10) List<@NotNull @Positive Long> optionIds
) {}
