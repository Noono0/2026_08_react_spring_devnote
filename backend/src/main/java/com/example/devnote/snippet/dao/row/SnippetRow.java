package com.example.devnote.snippet.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class SnippetRow {
    private Long developerSnippetId;
    private Long memberId;
    private String snippetTitle;
    private String snippetDescription;
    private String snippetLanguage;
    private String snippetCode;
    private String tagsJson;
    private String favoriteYn;
    private String useYn;
    private LocalDateTime deletedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

