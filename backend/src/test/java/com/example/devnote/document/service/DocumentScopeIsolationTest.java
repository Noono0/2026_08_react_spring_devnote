package com.example.devnote.document.service;

import com.example.devnote.document.dao.DocumentDao;
import com.example.devnote.document.dao.row.DocumentDetailRow;
import com.example.devnote.document.dto.DocumentScope;
import com.example.devnote.document.exception.DocumentNotFoundException;
import com.example.devnote.file.dao.FileResourceDao;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentScopeIsolationTest {
    @Mock private DocumentDao documentDao;
    @Mock private FileResourceDao fileResourceDao;

    @Test
    void practiceApiCannotReadHistoryDocument() {
        DocumentDetailRow historyDocument = new DocumentDetailRow();
        historyDocument.setDocumentId(101L);
        historyDocument.setDocumentScope(DocumentScope.HISTORY.name());
        historyDocument.setUseYn("Y");
        when(documentDao.selectDocumentById(101L)).thenReturn(historyDocument);
        DocumentServiceImpl service = new DocumentServiceImpl(documentDao, fileResourceDao, new ObjectMapper());

        assertThatThrownBy(() -> service.getDocumentDetail(101L, DocumentScope.PRACTICE))
            .isInstanceOf(DocumentNotFoundException.class);
    }

    @Test
    void historyApiCannotReadPracticeDocument() {
        DocumentDetailRow practiceDocument = new DocumentDetailRow();
        practiceDocument.setDocumentId(1L);
        practiceDocument.setDocumentScope(DocumentScope.PRACTICE.name());
        practiceDocument.setUseYn("Y");
        when(documentDao.selectDocumentById(1L)).thenReturn(practiceDocument);
        DocumentServiceImpl service = new DocumentServiceImpl(documentDao, fileResourceDao, new ObjectMapper());

        assertThatThrownBy(() -> service.getDocumentDetail(1L, DocumentScope.HISTORY))
            .isInstanceOf(DocumentNotFoundException.class);
    }
}
