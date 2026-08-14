package com.example.devnote.common.exception;

public record FieldErrorResponse(String fieldName, Object rejectedValue, String message) {
}
