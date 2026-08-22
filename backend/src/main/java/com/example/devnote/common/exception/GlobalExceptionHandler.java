package com.example.devnote.common.exception;

import jakarta.servlet.http.HttpServletRequest;
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

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ProblemDetail handleBusinessException(
        BusinessException businessException,
        HttpServletRequest request
    ) {
        ErrorCode errorCode = businessException.getErrorCode();
        log.warn("[BusinessException] code={}, method={}, uri={}, message={}",
            errorCode.getCode(), request.getMethod(), request.getRequestURI(), businessException.getMessage());
        return createProblemDetail(errorCode, businessException.getMessage(), request, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidationException(
        MethodArgumentNotValidException validationException,
        HttpServletRequest request
    ) {
        List<FieldErrorResponse> fieldErrors = validationException.getBindingResult().getFieldErrors().stream()
            .map(fieldError -> new FieldErrorResponse(
                fieldError.getField(),
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
