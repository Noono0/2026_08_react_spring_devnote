package com.example.devnote.document.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

public class DocumentEditForbiddenException extends BusinessException {
    public DocumentEditForbiddenException() {
        super(ErrorCode.DOCUMENT_EDIT_FORBIDDEN);
    }
}
