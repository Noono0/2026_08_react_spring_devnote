package com.example.devnote.board.todo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.time.Instant;
import java.util.List;

/** 소유자 번호는 받지 않는다. 서버가 세션 또는 비회원 쿠키에서 확인한다. */
public final class TodoDtos {
    private TodoDtos() {}
    public enum Status { ALL, ACTIVE, DONE }
    public record OwnerView(String mode, String cacheKey) {}
    public record GuestMergePreview(long count, String guestKey, long throughTodoId) {}
    public record GuestMergeRequest(
        @NotNull @Positive Long expectedMemberId,
        @NotBlank @Pattern(regexp = "guest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String guestKey,
        @NotNull @Positive Long throughTodoId
    ) {}
    public record GuestMergeResult(int mergedCount) {}
    public record TodoRequest(@NotBlank @Size(max = 200) String title,
        @NotNull @Size(max = 10000) String content, boolean completed, @Positive Long versionNumber,
        @Size(max = 20) List<@NotNull Instant> reminderTimes) {
        public TodoRequest(String title, String content, boolean completed, Long versionNumber) {
            this(title, content, completed, versionNumber, null);
        }
    }
    public record Reminder(long reminderId, Instant scheduledAt, String status) {}
    public record Todo(long todoId, String title, String content, boolean completed, long versionNumber,
        LocalDateTime createdAt, LocalDateTime updatedAt, List<Reminder> reminders) {}
}
