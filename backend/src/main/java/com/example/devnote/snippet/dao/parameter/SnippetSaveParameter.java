package com.example.devnote.snippet.dao.parameter;

import lombok.Builder;
import lombok.Getter;

/**
 * 코드 조각 INSERT·UPDATE용 값. 태그 목록은 JSON 문자열(tagsJson, 예: ["react","hook"])로,
 * 즐겨찾기는 'Y'/'N'(favoriteYn)으로 바꿔 저장한다.
 */
@Getter
@Builder
public class SnippetSaveParameter {
    private Long developerSnippetId;
    private Long memberId;
    private String snippetTitle;
    private String snippetDescription;
    private String snippetLanguage;
    private String snippetCode;
    private String tagsJson;
    private String favoriteYn;
}

