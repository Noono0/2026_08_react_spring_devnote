package com.example.devnote.common.exception;

/**
 * 입력값 검증 실패 한 건. 오류 응답의 fieldErrors 배열에 담긴다.
 *
 *   { "fieldName": "documentTitle", "rejectedValue": "", "message": "문서 제목은 필수입니다." }
 *
 * 프론트엔드는 fieldName으로 "어느 입력칸의 오류인지" 찾아 그 칸 아래에 메시지를 붙인다.
 * (DocumentEditorPage의 setError 부분이 이 값을 사용한다)
 */
public record FieldErrorResponse(String fieldName, Object rejectedValue, String message) {
}
