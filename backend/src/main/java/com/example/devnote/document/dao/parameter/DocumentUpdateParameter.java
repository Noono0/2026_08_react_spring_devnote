package com.example.devnote.document.dao.parameter;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DocumentUpdateParameter {
    private Long documentId;
    private Long memberId;
    private Long thumbnailFileId;
    private String documentTitle;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private String documentStatus;
    private String documentScope;
    private Long versionNumber;
}
