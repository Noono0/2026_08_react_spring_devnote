package com.example.devnote.document.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/**
 * 작성자가 아닌 회원이 문서를 수정·삭제하려 할 때(403).
 * ErrorCode만 정해 둔 작은 예외 클래스: Service 코드에서 "무슨 실패인지"가 클래스 이름만으로 읽힌다.
 */
public class DocumentEditForbiddenException extends BusinessException {
    public DocumentEditForbiddenException() {
        super(ErrorCode.DOCUMENT_EDIT_FORBIDDEN);
    }
}
