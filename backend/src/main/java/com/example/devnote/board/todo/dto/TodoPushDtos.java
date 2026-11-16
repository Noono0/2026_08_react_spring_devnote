package com.example.devnote.board.todo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class TodoPushDtos {
    private TodoPushDtos() {}
    public record Settings(boolean configured, String publicKey, boolean subscribed) {}
    public record SubscriptionRequest(@NotBlank @Size(max = 80) String expectedOwnerKey,
        @NotBlank @Size(max = 2048) String endpoint) {
        // AOP 로그에 구독 주소와 암호화 정보를 남기지 않는다. / Never log push capabilities.
        @Override public String toString() { return "SubscriptionRequest[credentials=redacted]"; }
    }
}
