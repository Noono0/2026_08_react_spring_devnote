package com.example.devnote.document.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

public class DocumentVersionConflictException extends BusinessException {
    public DocumentVersionConflictException() {
        super(ErrorCode.DOCUMENT_VERSION_CONFLICT);
    }
}
