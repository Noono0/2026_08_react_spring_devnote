package com.example.devnote.admin.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 등급 수정 요청. 이름은 필수(50자 이하), 기준 점수·순서는 0 이상. 등급 코드 자체는 주소(/grades/{gradeCode})로 받는다. */
public record GradeUpdateRequest(@NotBlank @Size(max = 50) String gradeName, @Min(0) int minimumPoints, @Min(0) int sortOrder, boolean active) {
}
