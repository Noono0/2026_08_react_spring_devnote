package com.example.devnote.document.dao.row;

import lombok.Getter;
import lombok.Setter;

/** document_tags 한 줄. 여러 문서의 태그를 한 번에 읽은 뒤 문서별로 묶는 데 쓴다. */
@Getter
@Setter
public class DocumentTagRow {
    private Long documentId;
    private String tagName;
}
