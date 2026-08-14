package com.example.devnote.document.controller;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dto.DocumentDetailResponse;
import com.example.devnote.document.dto.DocumentSearchCondition;
import com.example.devnote.document.dto.DocumentScope;
import com.example.devnote.document.dto.DocumentStatus;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.document.service.DocumentService;
import com.example.devnote.member.service.AuthenticationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HistoryControllerTest {
    @Mock private DocumentService documentService;
    @Mock private AuthenticationService authenticationService;

    @Test
    void guestListAlwaysForcesPublishedOwnerHistory() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        DocumentSearchCondition condition = new DocumentSearchCondition();
        when(documentService.getDocumentList(condition)).thenReturn(PageResponse.of(List.of(), 0, 20, 0));
        HistoryController controller = new HistoryController(documentService, authenticationService);

        controller.getHistory(condition, request);

        assertThat(condition.getAuthorId()).isEqualTo(1L);
        assertThat(condition.getDocumentScope()).isEqualTo(DocumentScope.HISTORY);
        assertThat(condition.getDocumentStatus()).isEqualTo(DocumentStatus.PUBLISHED);
        verify(documentService).getDocumentList(condition);
    }

    @Test
    void guestCannotOpenDraftHistoryDirectly() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        DocumentDetailResponse draft = new DocumentDetailResponse(1L, 1L, "관리자", "임시 글",
            new ObjectMapper().createObjectNode(), "<p></p>", "", null, null, List.of(), "DRAFT",
            1L, 0L, LocalDateTime.now(), LocalDateTime.now());
        when(documentService.getDocumentDetail(1L, DocumentScope.HISTORY)).thenReturn(draft);
        HistoryController controller = new HistoryController(documentService, authenticationService);

        assertThatThrownBy(() -> controller.getHistoryDetail(1L, request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DOCUMENT_NOT_FOUND));
    }
}
