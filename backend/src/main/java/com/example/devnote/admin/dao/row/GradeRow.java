package com.example.devnote.admin.dao.row;

import lombok.Getter;
import lombok.Setter;

/** member_grades 한 행: 등급 코드(BRONZE…), 화면 표시 이름, 승급 기준 점수, 표시 순서, 사용 여부. */
@Getter @Setter
public class GradeRow {
    private String gradeCode;
    private String gradeName;
    private int minimumPoints;
    private int sortOrder;
    private String useYn;
}
