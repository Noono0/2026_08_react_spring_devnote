package com.example.devnote.admin.dto;

/** 통계 그래프의 점 하나(기간, 방문자 수, 조회 수). */
public record VisitSeriesItem(String period, long visitors, long pageViews) {
}
