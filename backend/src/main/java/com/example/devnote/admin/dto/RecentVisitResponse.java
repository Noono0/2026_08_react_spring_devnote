package com.example.devnote.admin.dto;

import java.time.LocalDateTime;

/** 최근 방문 응답. visitorKey는 전체 대신 앞 8글자만 보낸다(같은 방문자인지 구분할 정도면 충분하다). */
public record RecentVisitResponse(
    String visitorKey,
    Long memberId,
    String loginId,
    String memberName,
    String visitedPath,
    LocalDateTime visitedAt
) {}
