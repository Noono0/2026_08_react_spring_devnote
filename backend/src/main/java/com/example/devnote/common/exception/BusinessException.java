package com.example.devnote.common.exception;

import lombok.Getter;

/**
 * "업무 규칙 위반"을 알리는 예외입니다. (예: 문서가 없음, 권한 없음, 버전 충돌)
 *
 * [왜 예외를 던지나? 그냥 null이나 false를 돌려주면 안 되나?]
 *   Service 깊은 곳에서 문제가 생겼을 때 예외를 던지면, 중간 단계마다 "실패했나?"를 확인할 필요 없이
 *   GlobalExceptionHandler가 한 곳에서 받아 알맞은 HTTP 상태와 메시지로 바꿔 준다.
 *   또 @Transactional 메서드에서 RuntimeException이 나면 그동안의 DB 변경이 자동으로 취소(롤백)된다.
 *
 * RuntimeException을 상속한 이유: throws 선언 없이 어디서나 던질 수 있는 "언체크 예외"라서
 * 메서드마다 throws BusinessException을 적지 않아도 된다.
 *
 * ★ 메시지는 사용자 화면에 그대로 나갈 수 있으므로 내부 정보(SQL, 파일 경로 등)를 넣지 않는다.
 */
@Getter
public class BusinessException extends RuntimeException {
    /** 어떤 종류의 실패인지. HTTP 상태와 프론트엔드가 구분할 오류 코드를 함께 담고 있다. */
    private final ErrorCode errorCode;

    /** ErrorCode에 미리 적어 둔 기본 문구를 그대로 쓴다. */
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    /**
     * 상황에 맞는 문구로 바꿔 쓴다. 예: "첨부파일은 최대 20개까지 등록할 수 있습니다."
     * 이름이 safeMessage인 이유: 사용자에게 보여도 안전한 문구만 넣으라는 약속이다.
     */
    public BusinessException(ErrorCode errorCode, String safeMessage) {
        super(safeMessage);
        this.errorCode = errorCode;
    }
}
