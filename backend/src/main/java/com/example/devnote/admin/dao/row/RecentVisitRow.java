package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 최근 방문 한 건. 회원이면 아이디·이름이 함께 오고(LEFT JOIN), 비회원이면 둘 다 null이다. */
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
