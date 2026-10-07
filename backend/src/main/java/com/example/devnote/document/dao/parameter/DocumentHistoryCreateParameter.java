package com.example.devnote.document.dao.parameter;

import lombok.Builder;
import lombok.Getter;

/**
 * 이력(document_histories) INSERT용 값 묶음. 수정 "전" 문서의 스냅샷이다.
 * changeSummary는 사용자가 적은 변경 요약, changedBy는 수정한 회원 번호다.
 */
@Getter
@Builder
public class DocumentHistoryCreateParameter {
    private Long documentId;
    private Long versionNumber;
    private Long thumbnailFileId;
    private String documentTitle;
    private String documentStatus;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private String changeSummary;
    private Long changedBy;
}
