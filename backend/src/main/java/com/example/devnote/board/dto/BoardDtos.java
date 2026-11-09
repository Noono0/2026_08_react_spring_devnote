package com.example.devnote.board.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;

/** 게시판의 공통 API 계약. Tiptap 본문은 편집용 JSON, 표시용 HTML, 검색용 텍스트로 보관한다. */
public final class BoardDtos {
    private BoardDtos() {}

    public enum BoardType { GENERAL, NOTICE, QNA, GALLERY, GRID, CALENDAR }

    public record PostRequest(
        @NotBlank @Size(max = 200) String title,
        @NotNull JsonNode contentJson,
        @NotBlank @Size(max = 200000) String contentHtml,
        @NotNull @Size(max = 100000) String contentText,
        Long imageFileId,
        boolean pinned,
        Long versionNumber,
        LocalDate eventDate
    ) {}

    public record AnswerRequest(
        @NotNull JsonNode contentJson,
        @NotBlank @Size(max = 200000) String contentHtml,
        @NotNull @Size(max = 100000) String contentText
    ) {}

    public record PostSummary(
        long postId, BoardType boardType, String title, String authorName,
        String contentPreview, boolean pinned, boolean answered, Long imageFileId,
        long viewCount, LocalDateTime createdAt, LocalDate eventDate
    ) {}

    /** 월 전체 일정. 최대 500건을 표시하고 초과 여부를 화면에 알린다. */
    public record CalendarMonthResponse(List<PostSummary> content, boolean truncated) {}

    public record AnswerResponse(
        long answerId, JsonNode contentJson, String contentHtml, String authorName,
        LocalDateTime createdAt
    ) {}

    public record PostDetail(
        long postId, BoardType boardType, String title, JsonNode contentJson,
        String contentHtml, String contentText, String authorName,
        boolean pinned, boolean answered, Long imageFileId, long viewCount, long versionNumber,
        boolean canEdit, boolean canDelete, boolean canAnswer,
        LocalDateTime createdAt, LocalDateTime updatedAt, LocalDate eventDate, AnswerResponse answer
    ) {}
}
