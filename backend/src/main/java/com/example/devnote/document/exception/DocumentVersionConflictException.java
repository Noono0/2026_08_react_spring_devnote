package com.example.devnote.document.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/**
 * 화면이 읽은 뒤에 다른 곳에서 먼저 수정돼 버전이 맞지 않을 때(409 Conflict).
 * 프론트(DocumentEditorPage)는 이 오류를 받으면 '다른 사용자가 먼저 수정했다'는 알림을 띄운다.
 */
public class DocumentVersionConflictException extends BusinessException {
    public DocumentVersionConflictException() {
        super(ErrorCode.DOCUMENT_VERSION_CONFLICT);
    }
}
