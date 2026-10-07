package com.example.devnote.diagram.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/** 저장하려는 모델이 올바른 JSON이 아닐 때(400). */
public class DiagramModelInvalidException extends BusinessException {
    public DiagramModelInvalidException() {
        super(ErrorCode.DIAGRAM_MODEL_INVALID);
    }
}
