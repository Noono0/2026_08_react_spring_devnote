package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

/** 통계 그래프의 점 하나. period = "2026-10-05"(일별) 또는 "2026-10"(월별), visitors = 방문자 수, pageViews = 조회 수. */
@Getter @Setter
public class VisitSeriesRow {
    private String period;
    private long visitors;
    private long pageViews;
}
