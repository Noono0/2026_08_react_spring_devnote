package com.example.devnote.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    COMMON_INVALID_REQUEST(HttpStatus.BAD_REQUEST, "COMMON_INVALID_REQUEST", "입력한 요청값을 확인해 주세요."),
    COMMON_INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "COMMON_INTERNAL_SERVER_ERROR", "서버에서 요청을 처리하지 못했습니다."),
    COMMON_RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "COMMON_RESOURCE_NOT_FOUND", "요청한 API 또는 리소스를 찾을 수 없습니다."),
    COMMON_METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "COMMON_METHOD_NOT_ALLOWED", "지원하지 않는 HTTP 메서드입니다."),
    AUTHENTICATION_REQUIRED(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "로그인이 필요합니다."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "요청한 기능을 사용할 권한이 없습니다."),
    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED", "아이디 또는 비밀번호가 올바르지 않습니다."),
    ACCOUNT_NOT_ACTIVE(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_ACTIVE", "현재 사용할 수 없는 계정입니다."),
    LOGIN_ID_ALREADY_EXISTS(HttpStatus.CONFLICT, "LOGIN_ID_ALREADY_EXISTS", "이미 사용 중인 아이디입니다."),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다."),
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "회원을 찾을 수 없습니다."),
    POLL_NOT_FOUND(HttpStatus.NOT_FOUND, "POLL_NOT_FOUND", "투표를 찾을 수 없습니다."),
    POLL_CLOSED(HttpStatus.CONFLICT, "POLL_CLOSED", "종료된 투표에는 참여할 수 없습니다."),
    POLL_OPTION_INVALID(HttpStatus.BAD_REQUEST, "POLL_OPTION_INVALID", "해당 투표의 선택지가 아닙니다."),
    POLL_ALREADY_VOTED(HttpStatus.CONFLICT, "POLL_ALREADY_VOTED", "이미 이 투표에 참여했습니다."),
    POLL_SELECTION_COUNT_INVALID(HttpStatus.BAD_REQUEST, "POLL_SELECTION_COUNT_INVALID", "선택할 수 있는 문항 수를 확인해 주세요."),
    POLL_END_TIME_INVALID(HttpStatus.BAD_REQUEST, "POLL_END_TIME_INVALID", "투표 종료 시간은 현재부터 60분 이내로 설정해 주세요."),
    POLL_EDIT_NOT_ALLOWED(HttpStatus.CONFLICT, "POLL_EDIT_NOT_ALLOWED", "참여자가 있는 투표의 문항은 변경할 수 없습니다."),
    POLL_STATUS_INVALID(HttpStatus.CONFLICT, "POLL_STATUS_INVALID", "현재 투표 상태에서는 요청한 상태로 변경할 수 없습니다."),
    SNIPPET_NOT_FOUND(HttpStatus.NOT_FOUND, "SNIPPET_NOT_FOUND", "코드 조각을 찾을 수 없습니다."),
    PORTFOLIO_SECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "PORTFOLIO_SECTION_NOT_FOUND", "포트폴리오 섹션을 찾을 수 없습니다."),
    PORTFOLIO_VERSION_CONFLICT(HttpStatus.CONFLICT, "PORTFOLIO_VERSION_CONFLICT", "다른 화면에서 포트폴리오를 먼저 수정했습니다."),
    DOCUMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "요청한 문서를 찾을 수 없습니다."),
    DOCUMENT_EDIT_FORBIDDEN(HttpStatus.FORBIDDEN, "DOCUMENT_EDIT_FORBIDDEN", "이 문서를 수정할 권한이 없습니다."),
    DOCUMENT_DELETE_FORBIDDEN(HttpStatus.FORBIDDEN, "DOCUMENT_DELETE_FORBIDDEN", "이 문서를 삭제할 권한이 없습니다."),
    DOCUMENT_VERSION_CONFLICT(HttpStatus.CONFLICT, "DOCUMENT_VERSION_CONFLICT", "다른 사용자가 먼저 문서를 수정했습니다."),
    DOCUMENT_ALREADY_DELETED(HttpStatus.CONFLICT, "DOCUMENT_ALREADY_DELETED", "이미 삭제된 문서입니다."),
    FILE_NOT_FOUND(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "요청한 파일을 찾을 수 없습니다."),
    FILE_ACCESS_FORBIDDEN(HttpStatus.FORBIDDEN, "FILE_ACCESS_FORBIDDEN", "다른 사용자가 업로드한 파일은 사용할 수 없습니다."),
    FILE_NOT_IMAGE(HttpStatus.UNPROCESSABLE_ENTITY, "FILE_NOT_IMAGE", "이미지 파일만 대표 이미지로 사용할 수 있습니다."),
    FILE_EXTENSION_NOT_ALLOWED(HttpStatus.UNPROCESSABLE_ENTITY, "FILE_EXTENSION_NOT_ALLOWED", "허용되지 않은 파일 확장자입니다."),
    FILE_SIZE_EXCEEDED(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_SIZE_EXCEEDED", "업로드 가능한 파일 크기를 초과했습니다."),
    FILE_EMPTY(HttpStatus.BAD_REQUEST, "FILE_EMPTY", "비어 있는 파일은 업로드할 수 없습니다."),
    FILE_STORAGE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_STORAGE_FAILED", "파일 저장 중 오류가 발생했습니다."),
    DIAGRAM_NOT_FOUND(HttpStatus.NOT_FOUND, "DIAGRAM_NOT_FOUND", "요청한 다이어그램을 찾을 수 없습니다."),
    DIAGRAM_VERSION_CONFLICT(HttpStatus.CONFLICT, "DIAGRAM_VERSION_CONFLICT", "다른 화면에서 다이어그램을 먼저 수정했습니다."),
    DIAGRAM_MODEL_INVALID(HttpStatus.UNPROCESSABLE_ENTITY, "DIAGRAM_MODEL_INVALID", "다이어그램 데이터 형식이 올바르지 않습니다."),
    DIAGRAM_VERSION_NOT_FOUND(HttpStatus.NOT_FOUND, "DIAGRAM_VERSION_NOT_FOUND", "요청한 다이어그램 버전을 찾을 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String defaultMessage;
}
