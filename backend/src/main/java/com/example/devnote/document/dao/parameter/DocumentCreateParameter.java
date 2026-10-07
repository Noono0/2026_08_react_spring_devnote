package com.example.devnote.document.dao.parameter;

import lombok.Getter;
import lombok.Setter;

/**
 * 문서 INSERT에 넘기는 값 묶음(DAO 전용).
 * 요청 DTO와 달리 서버가 정한 값(작성자 memberId, 범위 documentScope)과 문자열로 바꾼 본문(contentJson)을 담는다.
 */
@Getter
@Setter
public class DocumentCreateParameter {
    // INSERT 전에는 비어 있고, INSERT 후 MyBatis가 DB가 만든 번호를 채운다(useGeneratedKeys). 그래서 @Setter가 필요하다.
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
