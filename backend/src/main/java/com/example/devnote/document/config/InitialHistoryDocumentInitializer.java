package com.example.devnote.document.config;

import com.example.devnote.document.dao.DocumentDao;
import com.example.devnote.document.dto.DocumentScope;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class InitialHistoryDocumentInitializer implements ApplicationRunner {
    private final DocumentDao documentDao;

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        documentDao.updateDocumentScope(101L, DocumentScope.HISTORY.name());
        documentDao.updateDocumentScope(102L, DocumentScope.HISTORY.name());
    }
}
