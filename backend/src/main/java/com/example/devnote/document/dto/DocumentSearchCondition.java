package com.example.devnote.document.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * 문서 목록 검색 조건. GET 쿼리 문자열(?searchKeyword=...&pageNumber=0)이 @ModelAttribute로 이 객체에 채워진다.
 * 그래서 record가 아니라 setter가 있는 일반 클래스다(Spring이 빈 객체를 만든 뒤 setter로 값을 넣는다).
 * 필드 초기값은 쿼리 문자열에 값이 없을 때의 기본값이다.
 */
@Getter
@Setter
@ToString
public class DocumentSearchCondition {
    private String searchKeyword = "";
    // TITLE / CONTENT / TITLE_CONTENT / AUTHOR 중 하나. 모르는 값은 Service가 TITLE_CONTENT로 바꾼다.
    private String searchType = "TITLE_CONTENT";
    private DocumentStatus documentStatus;
    // documentScope·authorId는 사용자가 보낸 값을 쓰지 않고 Controller가 덮어쓴다.
    private DocumentScope documentScope;
    private Long authorId;
    /** 이 태그가 붙은 문서만 찾는다. 비어 있으면 거르지 않는다. */
    @jakarta.validation.constraints.Size(max = 20, message = "태그는 20자 이하여야 합니다.")
    private String tag;

    // 페이지 번호는 0부터 시작한다(0 = 첫 페이지).
    @Min(value = 0, message = "페이지 번호는 0 이상이어야 합니다.")
    private int pageNumber = 0;

    // 한 번에 너무 많이 요청해 서버에 부담을 주지 않도록 최대 100건으로 제한한다.
    @Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
    @Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.")
    private int pageSize = 20;

    // 정렬 기준(CREATED_AT / UPDATED_AT / VIEW_COUNT / TITLE)과 방향(ASC / DESC). 허용 목록 검사는 Service가 한다.
    private String sortProperty = "UPDATED_AT";
    private String sortDirection = "DESC";

    /** SQL의 OFFSET 값: 앞에서 건너뛸 행 수. 예) 2페이지(pageNumber=1), 20건씩 → 20건 건너뜀. Mapper XML에서 #{offset}으로 읽는다. */
    public int getOffset() {
        return pageNumber * pageSize;
    }
}
