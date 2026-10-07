package com.example.devnote.file.service;

import com.example.devnote.file.config.FileStorageProperties;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.file.dao.row.FileResourceRow;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * 업로드만 하고 문서·포트폴리오 어디에도 쓰지 않은 임시(TEMP) 파일을 정리합니다.
 *
 * 파일은 업로드 순간 TEMP로 저장되고, 문서나 포트폴리오에 연결되면 ACTIVE가 됩니다.
 * 편집 중 이미지를 올렸다가 지우거나 저장하지 않고 나가면 TEMP 파일이 디스크에 계속 남습니다.
 * 단, 문서 본문 이미지는 저장 후에도 TEMP로 남으므로 상태만 보고 지우지 않고
 * Mapper에서 본문 HTML·첨부·썸네일·포트폴리오 연결까지 확인한 파일만 지웁니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TemporaryFileCleanupService {
    /** 한 번 실행에 지우는 최대 개수. 남은 파일은 다음 실행에서 이어서 정리합니다. */
    static final int CLEANUP_BATCH_SIZE = 500;

    private final FileResourceDao fileResourceDao;
    private final FileStorageProperties properties;

    // Docker 컨테이너의 기본 시간대는 UTC라 zone을 지정하지 않으면 04:30이 한국 시간 13:30이 됩니다.
    @Scheduled(
        cron = "${application.file-storage.temporary-file-cleanup-cron}",
        zone = "${application.file-storage.temporary-file-cleanup-zone}"
    )
    public void cleanUpOnSchedule() {
        CleanupResult result = cleanUpUnusedTemporaryFiles();
        if (result.candidateCount() > 0) {
            log.info("미사용 임시 파일 정리 완료 대상={} DB삭제처리={} 디스크삭제={}",
                result.candidateCount(), result.markedDeletedCount(), result.removedFromDiskCount());
        }
    }

    public CleanupResult cleanUpUnusedTemporaryFiles() {
        long retentionMinutes = properties.temporaryFileRetention().toMinutes();
        Path storageDirectory = Path.of(properties.rootDirectory()).toAbsolutePath().normalize();
        List<FileResourceRow> candidates = fileResourceDao.selectUnusedTemporaryFiles(retentionMinutes, CLEANUP_BATCH_SIZE);

        int markedDeletedCount = 0;
        int removedFromDiskCount = 0;
        for (FileResourceRow candidate : candidates) {
            Path storedFilePath = Path.of(candidate.getStoragePath()).toAbsolutePath().normalize();
            // DB에 저장된 경로가 저장소 밖을 가리키면 다른 파일을 지울 수 있으므로 건드리지 않습니다.
            if (!storedFilePath.startsWith(storageDirectory)) {
                log.warn("저장소 밖 경로라 임시 파일 정리를 건너뜁니다 fileId={}", candidate.getFileId());
                continue;
            }
            // 조회 직후 문서가 이 파일을 쓰기 시작했다면 0건이 바뀌므로 지우지 않습니다.
            if (fileResourceDao.markUnusedTemporaryFileDeleted(candidate.getFileId(), retentionMinutes) == 0) {
                continue;
            }
            markedDeletedCount++;
            try {
                if (Files.deleteIfExists(storedFilePath)) removedFromDiskCount++;
            } catch (IOException exception) {
                // DB에서는 이미 DELETED라 화면에 다시 나오지 않습니다. 디스크 파일만 남으므로 경고로 남깁니다.
                log.warn("임시 파일을 디스크에서 지우지 못했습니다 fileId={} reason={}",
                    candidate.getFileId(), exception.getMessage());
            }
        }
        return new CleanupResult(candidates.size(), markedDeletedCount, removedFromDiskCount);
    }

    public record CleanupResult(int candidateCount, int markedDeletedCount, int removedFromDiskCount) {
    }
}
