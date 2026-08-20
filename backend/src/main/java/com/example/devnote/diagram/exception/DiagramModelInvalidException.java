package com.example.devnote.diagram.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

public class DiagramModelInvalidException extends BusinessException {
    public DiagramModelInvalidException() {
        super(ErrorCode.DIAGRAM_MODEL_INVALID);
    }
}
