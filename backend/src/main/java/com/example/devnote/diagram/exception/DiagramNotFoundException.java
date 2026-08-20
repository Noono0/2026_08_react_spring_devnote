package com.example.devnote.diagram.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

public class DiagramNotFoundException extends BusinessException {
    public DiagramNotFoundException() {
        super(ErrorCode.DIAGRAM_NOT_FOUND);
    }
}
