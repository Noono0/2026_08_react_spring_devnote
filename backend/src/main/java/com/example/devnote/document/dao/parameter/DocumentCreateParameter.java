package com.example.devnote.document.dao.parameter;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DocumentCreateParameter {
    private Long documentId;
    private Long memberId;
    private Long thumbnailFileId;
    private String documentTitle;
    private String documentScope;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private String documentStatus;
}
