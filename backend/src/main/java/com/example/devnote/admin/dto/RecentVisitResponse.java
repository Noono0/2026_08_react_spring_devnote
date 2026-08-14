package com.example.devnote.admin.dto;

import java.time.LocalDateTime;

public record RecentVisitResponse(
    String visitorKey,
    Long memberId,
    String loginId,
    String memberName,
    String visitedPath,
    LocalDateTime visitedAt
) {}
