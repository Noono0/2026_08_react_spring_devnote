package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class RecentVisitRow {
    private String visitorKey;
    private Long memberId;
    private String loginId;
    private String memberName;
    private String visitedPath;
    private LocalDateTime visitedAt;
}
