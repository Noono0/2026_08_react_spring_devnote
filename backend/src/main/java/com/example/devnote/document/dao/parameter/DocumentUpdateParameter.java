package com.example.devnote.document.dao.parameter;

import lombok.Builder;
import lombok.Getter;

/**
 * 문서 UPDATE용 값 묶음.
 * memberId·documentScope·versionNumber는 바꿀 값이 아니라 WHERE 조건에 쓰인다(작성자·범위·버전이 맞을 때만 수정).
 */
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
