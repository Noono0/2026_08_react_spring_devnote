package com.example.devnote.diagram.exception;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

/** 다이어그램이 없거나, 삭제됐거나, 다른 회원의 것일 때(404 — 남의 것도 "없음"으로 답한다). */
public class DiagramNotFoundException extends BusinessException {
    public DiagramNotFoundException() {
        super(ErrorCode.DIAGRAM_NOT_FOUND);
    }
}
