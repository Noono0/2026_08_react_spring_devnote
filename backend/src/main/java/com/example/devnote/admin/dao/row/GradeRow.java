package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class GradeRow {
    private String gradeCode;
    private String gradeName;
    private int minimumPoints;
    private int sortOrder;
    private String useYn;
}
