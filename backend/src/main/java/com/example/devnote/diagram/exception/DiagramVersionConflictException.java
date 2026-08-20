package com.example.devnote.diagram.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

public class DiagramVersionConflictException extends BusinessException {
    public DiagramVersionConflictException() {
        super(ErrorCode.DIAGRAM_VERSION_CONFLICT);
    }
}
