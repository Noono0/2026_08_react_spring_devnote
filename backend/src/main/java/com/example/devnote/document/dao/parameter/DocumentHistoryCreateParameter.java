package com.example.devnote.document.dao.parameter;

import lombok.Builder;
import lombok.Getter;

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
