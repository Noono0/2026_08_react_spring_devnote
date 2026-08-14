package com.example.devnote.admin.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GradeUpdateRequest(@NotBlank @Size(max = 50) String gradeName, @Min(0) int minimumPoints, @Min(0) int sortOrder, boolean active) {
}
