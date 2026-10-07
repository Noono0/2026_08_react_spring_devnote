package com.example.devnote.snippet.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** developer_snippets 한 행. useYn = 'N'이면 휴지통에 있는 코드 조각이다. */
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

