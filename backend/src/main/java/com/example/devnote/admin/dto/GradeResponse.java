package com.example.devnote.admin.dto;

public record GradeResponse(String gradeCode, String gradeName, int minimumPoints, int sortOrder, boolean active) {
}
