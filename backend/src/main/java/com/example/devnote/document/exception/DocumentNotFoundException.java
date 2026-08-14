package com.example.devnote.document.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

public class DocumentNotFoundException extends BusinessException {
    public DocumentNotFoundException() {
        super(ErrorCode.DOCUMENT_NOT_FOUND);
    }
}
