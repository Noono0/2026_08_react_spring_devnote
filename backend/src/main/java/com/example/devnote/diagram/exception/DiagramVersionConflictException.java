package com.example.devnote.diagram.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/** 다른 탭·기기에서 먼저 저장해 버전이 맞지 않을 때(409). */
public class DiagramVersionConflictException extends BusinessException {
    public DiagramVersionConflictException() {
        super(ErrorCode.DIAGRAM_VERSION_CONFLICT);
    }
}
