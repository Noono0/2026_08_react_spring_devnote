package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class VisitSeriesRow {
    private String period;
    private long visitors;
    private long pageViews;
}
