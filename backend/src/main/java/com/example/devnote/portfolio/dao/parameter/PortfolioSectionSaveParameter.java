package com.example.devnote.portfolio.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * 섹션 INSERT·UPDATE용 값 묶음.
 * currentYn: "현재 진행 중" 여부를 DB 관례대로 'Y'/'N'으로 저장한다(요청에서는 boolean current).
 * versionNumber: 수정할 때 WHERE 조건(낙관적 잠금)에 쓰인다. 생성 때는 비어 있다.
 */
@Getter
@Builder
public class PortfolioSectionSaveParameter {
    // INSERT 후 MyBatis가 새 번호를 채운다(useGeneratedKeys). 그래서 이 필드만 setter가 있다.
    @Setter private Long portfolioSectionId;
    private String sectionType;
    private String contentMode;
    private String sectionTitle;
    private String sectionSubtitle;
    private LocalDate startDate;
    private LocalDate endDate;
    private String currentYn;
    private String externalUrl;
    private Long thumbnailFileId;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private String layoutType;
    private int sortOrder;
    private String visibility;
    private Long versionNumber;
}
