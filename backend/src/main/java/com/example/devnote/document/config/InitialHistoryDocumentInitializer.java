package com.example.devnote.document.config;

import com.example.devnote.document.dao.DocumentDao;
import com.example.devnote.document.dto.DocumentScope;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 서버가 켜질 때 101·102번 예시 글을 업무 History(HISTORY) 범위로 맞춥니다.
 *
 * [왜 필요한가?] data.sql은 INSERT IGNORE라서 "이미 있는 행"은 고치지 않는다.
 *   History 기능이 생기기 전에 만든 DB에서는 두 글이 PRACTICE로 남아 있으므로, 시작할 때마다 범위만 다시 맞춘다.
 *   (deleted_at IS NULL 조건이 있어, 사용자가 지운 글은 되살리지 않는다 — DocumentMapper.xml의 updateDocumentScope)
 */
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
