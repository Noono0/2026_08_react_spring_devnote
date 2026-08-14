package com.example.devnote.snippet.dao.parameter;

import lombok.Builder;
import lombok.Getter;

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

