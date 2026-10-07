package com.example.devnote.document.dto;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentRequestValidationTest {

    private static final ValidatorFactory VALIDATOR_FACTORY = Validation.buildDefaultValidatorFactory();
    private static final Validator VALIDATOR = VALIDATOR_FACTORY.getValidator();

    @AfterAll
    static void closeValidatorFactory() {
        VALIDATOR_FACTORY.close();
    }

    @Test
    void imageOnlyCreateRequestAllowsEmptySearchText() {
        DocumentCreateRequest request = new DocumentCreateRequest(
            "이미지 오류 로그",
            4L,
            List.of(),
            List.of(),
            JsonNodeFactory.instance.objectNode().put("type", "doc"),
            "<img src=\"/api/v1/files/4/content\" alt=\"error-log.png\">",
            "",
            DocumentStatus.DRAFT
        );

        assertTrue(VALIDATOR.validate(request).isEmpty());
    }

    @Test
    void imageOnlyUpdateRequestAllowsEmptySearchText() {
        DocumentUpdateRequest request = new DocumentUpdateRequest(
            "이미지 오류 로그",
            4L,
            List.of(),
            List.of(),
            JsonNodeFactory.instance.objectNode().put("type", "doc"),
            "<img src=\"/api/v1/files/4/content\" alt=\"error-log.png\">",
            "",
            DocumentStatus.DRAFT,
            1L,
            "이미지 추가"
        );

        assertTrue(VALIDATOR.validate(request).isEmpty());
    }

    @Test
    void nullSearchTextIsStillRejected() {
        DocumentCreateRequest request = new DocumentCreateRequest(
            "잘못된 문서",
            null,
            List.of(),
            List.of(),
            JsonNodeFactory.instance.objectNode().put("type", "doc"),
            "<p>내용</p>",
            null,
            DocumentStatus.DRAFT
        );

        assertFalse(VALIDATOR.validate(request).isEmpty());
    }

    @Test
    void tooManyTagsAreRejected() {
        DocumentCreateRequest request = new DocumentCreateRequest(
            "태그가 많은 문서",
            null,
            List.of(),
            java.util.stream.IntStream.rangeClosed(1, 11).mapToObj(index -> "태그" + index).toList(),
            JsonNodeFactory.instance.objectNode().put("type", "doc"),
            "<p>내용</p>",
            "내용",
            DocumentStatus.DRAFT
        );

        assertFalse(VALIDATOR.validate(request).isEmpty());
    }
}
