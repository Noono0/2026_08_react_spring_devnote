package com.example.devnote.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import com.example.devnote.crawler.service.CrawlerFailure;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 모든 Controller에서 던져진 예외를 한 곳에서 받아 "같은 모양의 오류 응답"으로 바꿉니다.
 *
 * [@RestControllerAdvice]
 *   모든 @RestController에 공통으로 적용되는 "예외 담당자"를 등록한다.
 *   Controller·Service는 문제가 생기면 예외만 던지고, 응답 만들기는 이 클래스가 맡는다.
 *   덕분에 Controller마다 try/catch를 반복하지 않는다.
 *
 * [@ExceptionHandler(X.class)]
 *   X 종류의 예외가 나면 그 메서드가 불린다. 더 구체적인 예외 타입의 메서드가 먼저 선택되고,
 *   어디에도 맞지 않으면 맨 아래 Exception.class(최후의 안전망)가 받는다.
 *
 * [ProblemDetail — 오류 응답 표준 형식(RFC 9457)]
 *   { "type", "title", "status", "detail", "instance" } 에 이 프로젝트용 값(errorCode, traceId, fieldErrors …)을 더해 보낸다.
 *   정상 응답(ApiResponse)과 모양이 다르므로 프론트엔드는 HTTP 상태로 성공/실패를 먼저 구분한다.
 *
 * ★ 예상하지 못한 오류(500)의 원인 메시지는 사용자에게 보내지 않는다(SQL·경로 같은 내부 정보 노출 방지).
 *   자세한 내용은 서버 로그에 남기고, 응답에는 traceId만 담아 로그와 연결한다.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 우리가 의도해서 던진 업무 오류(BusinessException). ErrorCode에 적힌 상태 코드·문구를 그대로 쓴다.
     * 업무 규칙상 "예상된 실패"이므로 error가 아니라 warn으로 기록한다(서버 고장이 아니다).
     */
    @ExceptionHandler(BusinessException.class)
    public ProblemDetail handleBusinessException(
        BusinessException businessException,
        HttpServletRequest request
    ) {
        ErrorCode errorCode = businessException.getErrorCode();
        log.warn("[BusinessException] code={}, method={}, uri={}, message={}",
            errorCode.getCode(), request.getMethod(), request.getRequestURI(), businessException.getMessage());
        ProblemDetail problem = createProblemDetail(errorCode, businessException.getMessage(), request, List.of());
        // 크롤러 실패는 "어느 단계에서 막혔고 무엇을 해 보면 되는지"를 화면에 보여 주기 위해 값을 더 담는다.
        // instanceof 패턴 매칭: 타입이 맞으면 failure라는 이름으로 바로 꺼내 쓴다(별도 형변환 불필요).
        if (businessException instanceof CrawlerFailure failure) {
            problem.setProperty("crawlerStage", failure.getStage());
            problem.setProperty("suggestedAction", failure.getAction());
            problem.setProperty("elapsedMillis", failure.getElapsedMillis());
            if (!failure.getTechnicalMessage().isBlank()) {
                problem.setProperty("technicalMessage", failure.getTechnicalMessage());
            }
            log.warn("[CrawlerFailure] stage={}, elapsedMillis={}", failure.getStage(), failure.getElapsedMillis());
        }
        return problem;
    }

    /**
     * @Valid @RequestBody 검증 실패(예: @NotBlank인 제목이 비어 있음).
     * 어느 칸이 왜 틀렸는지 fieldErrors로 모두 돌려줘 화면이 각 입력칸 아래에 표시할 수 있게 한다.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidationException(
        MethodArgumentNotValidException validationException,
        HttpServletRequest request
    ) {
        List<FieldErrorResponse> fieldErrors = validationException.getBindingResult().getFieldErrors().stream()
            .map(fieldError -> new FieldErrorResponse(
                fieldError.getField(),
                // 비밀번호·토큰은 응답에도 그대로 돌려보내지 않는다(화면·브라우저 기록·로그에 남을 수 있다).
                isSensitiveField(fieldError.getField()) ? "********" : fieldError.getRejectedValue(),
                fieldError.getDefaultMessage()
            ))
            .toList();

        log.warn("[ValidationException] method={}, uri={}, fieldErrorCount={}, fieldErrors={}",
            request.getMethod(),
            request.getRequestURI(),
            fieldErrors.size(),
            summarizeFieldErrors(fieldErrors));

        return createProblemDetail(
            ErrorCode.COMMON_INVALID_REQUEST,
            ErrorCode.COMMON_INVALID_REQUEST.getDefaultMessage(),
            request,
            fieldErrors
        );
    }

    /**
     * @Validated가 붙은 Controller의 메서드 파라미터 검증 실패(예: @Positive Long versionNumber).
     * 위의 본문 검증과 발생 위치만 다르고, 응답 모양은 똑같이 맞춘다.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraintViolationException(
        ConstraintViolationException exception,
        HttpServletRequest request
    ) {
        List<FieldErrorResponse> fieldErrors = exception.getConstraintViolations().stream()
            .map(violation -> new FieldErrorResponse(
                violation.getPropertyPath().toString(),
                isSensitiveField(violation.getPropertyPath().toString()) ? "********" : violation.getInvalidValue(),
                violation.getMessage()
            ))
            .toList();

        log.warn("[ConstraintViolationException] method={}, uri={}, fieldErrorCount={}, fieldErrors={}",
            request.getMethod(),
            request.getRequestURI(),
            fieldErrors.size(),
            summarizeFieldErrors(fieldErrors));

        return createProblemDetail(
            ErrorCode.COMMON_INVALID_REQUEST,
            ErrorCode.COMMON_INVALID_REQUEST.getDefaultMessage(),
            request,
            fieldErrors
        );
    }

    /**
     * 요청 자체의 형식 오류: JSON 문법 오류, 숫자 자리에 문자, 필수 쿼리·파일 파트 누락 등.
     * 예외 메시지에는 Java 클래스 이름 같은 내부 정보가 들어 있어 사용자에게는 일반 문구만 보낸다.
     */
    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class,
        MissingServletRequestParameterException.class,
        MissingServletRequestPartException.class
    })
    public ProblemDetail handleMalformedRequest(Exception exception, HttpServletRequest request) {
        log.warn("[MalformedRequest] method={}, uri={}, exception={}",
            request.getMethod(), request.getRequestURI(), exception.getClass().getSimpleName());
        return createProblemDetail(
            ErrorCode.COMMON_INVALID_REQUEST,
            "요청 형식이나 파라미터 값을 확인해 주세요.",
            request,
            List.of()
        );
    }

    /**
     * 업로드 크기 초과(application.yml의 spring.servlet.multipart 한도).
     * FileStorageService의 크기 검사보다 앞단(파일을 다 받기 전)에서 Spring이 던진다.
     * ★ 그보다 더 앞의 Nginx 한도(client_max_body_size)에 걸리면 이 메서드까지 오지 않고 Nginx가 413을 돌려준다.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail handleMaximumUploadSize(
        MaxUploadSizeExceededException exception,
        HttpServletRequest request
    ) {
        log.warn("[MaximumUploadSize] method={}, uri={}", request.getMethod(), request.getRequestURI());
        return createProblemDetail(
            ErrorCode.FILE_SIZE_EXCEEDED,
            ErrorCode.FILE_SIZE_EXCEEDED.getDefaultMessage(),
            request,
            List.of()
        );
    }

    /** Spring Security가 던지는 권한 거부. 이 프로젝트는 대부분 Service에서 직접 ACCESS_DENIED를 던지지만, 형식을 맞춰 둔다. */
    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDeniedException(
        AccessDeniedException exception,
        HttpServletRequest request
    ) {
        return createProblemDetail(
            ErrorCode.ACCESS_DENIED,
            ErrorCode.ACCESS_DENIED.getDefaultMessage(),
            request,
            List.of()
        );
    }

    /** 존재하지 않는 주소(정적 리소스·API 모두). 없으면 아래 500 처리로 떨어져 "서버 오류"로 잘못 보이게 된다. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail handleNoResourceFoundException(
        NoResourceFoundException exception,
        HttpServletRequest request
    ) {
        return createProblemDetail(
            ErrorCode.COMMON_RESOURCE_NOT_FOUND,
            ErrorCode.COMMON_RESOURCE_NOT_FOUND.getDefaultMessage(),
            request,
            List.of()
        );
    }

    /** 주소는 맞지만 메서드가 틀린 경우(예: GET만 있는 주소에 DELETE). */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ProblemDetail handleMethodNotSupportedException(
        HttpRequestMethodNotSupportedException exception,
        HttpServletRequest request
    ) {
        return createProblemDetail(
            ErrorCode.COMMON_METHOD_NOT_ALLOWED,
            ErrorCode.COMMON_METHOD_NOT_ALLOWED.getDefaultMessage(),
            request,
            List.of()
        );
    }

    /**
     * 최후의 안전망: 위에서 처리하지 못한 모든 예외(NullPointerException, DB 연결 오류 등 = 버그나 장애).
     * 로그에는 예외 전체(스택 트레이스)를 error로 남기고, 사용자에게는 일반 문구와 traceId만 보낸다.
     * log.error(..., exception): 마지막 인자로 예외 객체를 넘기면 스택 트레이스까지 함께 기록된다.
     */
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpectedException(Exception exception, HttpServletRequest request) {
        log.error("[UnexpectedException] method={}, uri={}", request.getMethod(), request.getRequestURI(), exception);
        return createProblemDetail(
            ErrorCode.COMMON_INTERNAL_SERVER_ERROR,
            ErrorCode.COMMON_INTERNAL_SERVER_ERROR.getDefaultMessage(),
            request,
            List.of()
        );
    }

    /**
     * 모든 오류 응답을 같은 모양으로 만드는 공통 함수. 프론트엔드의 apiErrorHelpers.ts가 이 모양을 읽는다.
     *   status/detail : HTTP 상태와 사용자용 문구
     *   title/errorCode: 오류 종류 코드(프론트가 메시지 맵에서 찾는 값)
     *   type          : 오류 종류를 나타내는 식별자(URN). 문서 주소가 없어 urn: 형식을 쓴다.
     *   instance      : 오류가 난 요청 주소
     *   traceId       : 서버 로그와 연결하는 추적 번호
     *   fieldErrors   : 입력칸별 오류(없으면 빈 배열 — 프론트가 null 검사를 하지 않아도 된다)
     */
    private ProblemDetail createProblemDetail(
        ErrorCode errorCode,
        String detail,
        HttpServletRequest request,
        List<FieldErrorResponse> fieldErrors
    ) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(errorCode.getHttpStatus(), detail);
        problemDetail.setTitle(errorCode.getCode());
        problemDetail.setType(URI.create("urn:devnote:error:" + errorCode.getCode().toLowerCase()));
        problemDetail.setInstance(URI.create(request.getRequestURI()));
        problemDetail.setProperty("errorCode", errorCode.getCode());
        problemDetail.setProperty("traceId", MDC.get("traceId"));
        problemDetail.setProperty("timestamp", OffsetDateTime.now());
        problemDetail.setProperty("fieldErrors", fieldErrors);
        return problemDetail;
    }

    /** 필드 이름에 password·token이 들어가면 민감 정보로 본다(passwordConfirm, accessToken 등도 포함). */
    private boolean isSensitiveField(String fieldName) {
        String normalizedFieldName = fieldName.toLowerCase();
        return normalizedFieldName.contains("password") || normalizedFieldName.contains("token");
    }

    /**
     * 검증 실패 원인은 운영 로그에서 바로 확인할 수 있게 하되, 거부된 실제 입력값은 기록하지 않습니다.
     * 비밀번호뿐 아니라 본문·토큰처럼 크거나 민감할 수 있는 값이 로그에 남는 사고를 방지합니다.
     */
    private String summarizeFieldErrors(List<FieldErrorResponse> fieldErrors) {
        return fieldErrors.stream()
            .map(fieldError -> fieldError.fieldName() + "=" + fieldError.message())
            .collect(Collectors.joining(", ", "[", "]"));
    }
}
