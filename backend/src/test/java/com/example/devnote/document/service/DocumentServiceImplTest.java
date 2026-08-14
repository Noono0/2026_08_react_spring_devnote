package com.example.devnote.document.service;

import com.example.devnote.document.dao.DocumentDao;
import com.example.devnote.document.dao.row.DocumentDetailRow;
import com.example.devnote.document.dto.DocumentStatus;
import com.example.devnote.document.dto.DocumentUpdateRequest;
import com.example.devnote.document.exception.DocumentVersionConflictException;
import com.example.devnote.file.dao.FileResourceDao;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentServiceImplTest {
    @Mock
    private DocumentDao documentDao;

    @Mock
    private FileResourceDao fileResourceDao;

    private DocumentServiceImpl documentService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        documentService = new DocumentServiceImpl(documentDao, fileResourceDao, objectMapper);
    }

    @Test
    void staleVersionDoesNotInsertDuplicateHistory() {
        DocumentDetailRow existingDocument = new DocumentDetailRow();
        existingDocument.setDocumentId(1L);
        existingDocument.setAuthorId(1L);
        existingDocument.setAuthorName("일반 사용자");
        existingDocument.setDocumentTitle("기존 제목");
        existingDocument.setDocumentScope("PRACTICE");
        existingDocument.setContentJson("{\"type\":\"doc\",\"content\":[]}");
        existingDocument.setContentHtml("<p>기존 내용</p>");
        existingDocument.setContentText("기존 내용");
        existingDocument.setDocumentStatus("DRAFT");
        existingDocument.setVersionNumber(1L);
        existingDocument.setViewCount(0L);
        existingDocument.setUseYn("Y");

        when(documentDao.selectDocumentById(1L)).thenReturn(existingDocument);
        when(documentDao.updateDocument(any())).thenReturn(0);

        DocumentUpdateRequest request = new DocumentUpdateRequest(
            "수정 제목",
            null,
            java.util.List.of(),
            objectMapper.createObjectNode().put("type", "doc"),
            "<p>수정 내용</p>",
            "수정 내용",
            DocumentStatus.DRAFT,
            1L,
            "수정 테스트"
        );

        assertThatThrownBy(() -> documentService.updateDocument(1L, request, 1L))
            .isInstanceOf(DocumentVersionConflictException.class);

        verify(documentDao, never()).insertDocumentHistory(any());
    }
}
