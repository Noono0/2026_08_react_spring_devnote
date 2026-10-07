package com.example.devnote.document.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/** 문서가 없거나, 삭제됐거나, 다른 범위(PRACTICE/HISTORY)의 문서일 때(404). */
public class DocumentNotFoundException extends BusinessException {
    public DocumentNotFoundException() {
        super(ErrorCode.DOCUMENT_NOT_FOUND);
    }
}
