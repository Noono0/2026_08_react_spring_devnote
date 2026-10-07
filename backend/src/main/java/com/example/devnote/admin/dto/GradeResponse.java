package com.example.devnote.admin.dto;

/** 등급 응답. DB의 use_yn('Y'/'N')을 화면에서 쓰기 쉬운 boolean active로 바꿔 보낸다. */
public record GradeResponse(String gradeCode, String gradeName, int minimumPoints, int sortOrder, boolean active) {
}
