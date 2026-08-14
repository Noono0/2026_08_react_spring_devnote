package com.example.devnote.poll.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record PollCreateRequest(
    @NotBlank @Size(max = 300) String question,
    @NotNull @Size(min = 2, max = 10) List<@NotBlank @Size(max = 200) String> options,
    @NotNull Boolean allowMultiple,
    @NotNull @Min(1) @Max(10) Integer maxSelections,
    @NotNull Boolean realtimeResults,
    Instant endsAt
) {}
