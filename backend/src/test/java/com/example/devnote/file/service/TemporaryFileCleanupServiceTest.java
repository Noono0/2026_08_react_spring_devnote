package com.example.devnote.file.service;

import com.example.devnote.file.config.FileStorageProperties;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.file.dao.row.FileResourceRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemporaryFileCleanupServiceTest {
    private static final long RETENTION_MINUTES = 24 * 60;

    @Mock private FileResourceDao fileResourceDao;
    @TempDir private Path storageDirectory;

    @Test
    void deletesDiskFileOnlyAfterDatabaseMarksItDeleted() throws IOException {
        Path storedFile = Files.writeString(storageDirectory.resolve("unused.png"), "image");
        when(fileResourceDao.selectUnusedTemporaryFiles(RETENTION_MINUTES, TemporaryFileCleanupService.CLEANUP_BATCH_SIZE))
            .thenReturn(List.of(row(10L, storedFile)));
        when(fileResourceDao.markUnusedTemporaryFileDeleted(10L, RETENTION_MINUTES)).thenReturn(1);

        var result = service().cleanUpUnusedTemporaryFiles();

        assertThat(result).isEqualTo(new TemporaryFileCleanupService.CleanupResult(1, 1, 1));
        assertThat(storedFile).doesNotExist();
    }

    @Test
    void keepsDiskFileWhenFileStartedBeingUsedAfterSelection() throws IOException {
        Path storedFile = Files.writeString(storageDirectory.resolve("now-used.png"), "image");
        when(fileResourceDao.selectUnusedTemporaryFiles(RETENTION_MINUTES, TemporaryFileCleanupService.CLEANUP_BATCH_SIZE))
            .thenReturn(List.of(row(11L, storedFile)));
        when(fileResourceDao.markUnusedTemporaryFileDeleted(11L, RETENTION_MINUTES)).thenReturn(0);

        var result = service().cleanUpUnusedTemporaryFiles();

        assertThat(result).isEqualTo(new TemporaryFileCleanupService.CleanupResult(1, 0, 0));
        assertThat(storedFile).exists();
    }

    @Test
    void neverTouchesPathOutsideStorageDirectory(@TempDir Path otherDirectory) throws IOException {
        Path outsideFile = Files.writeString(otherDirectory.resolve("outside.png"), "image");
        when(fileResourceDao.selectUnusedTemporaryFiles(RETENTION_MINUTES, TemporaryFileCleanupService.CLEANUP_BATCH_SIZE))
            .thenReturn(List.of(row(12L, outsideFile)));

        var result = service().cleanUpUnusedTemporaryFiles();

        assertThat(result).isEqualTo(new TemporaryFileCleanupService.CleanupResult(1, 0, 0));
        assertThat(outsideFile).exists();
        verify(fileResourceDao, never()).markUnusedTemporaryFileDeleted(anyLong(), anyLong());
    }

    @Test
    void marksRowDeletedEvenWhenDiskFileIsAlreadyMissing() {
        Path missingFile = storageDirectory.resolve("missing.png");
        when(fileResourceDao.selectUnusedTemporaryFiles(RETENTION_MINUTES, TemporaryFileCleanupService.CLEANUP_BATCH_SIZE))
            .thenReturn(List.of(row(13L, missingFile)));
        when(fileResourceDao.markUnusedTemporaryFileDeleted(13L, RETENTION_MINUTES)).thenReturn(1);

        var result = service().cleanUpUnusedTemporaryFiles();

        assertThat(result).isEqualTo(new TemporaryFileCleanupService.CleanupResult(1, 1, 0));
    }

    private TemporaryFileCleanupService service() {
        FileStorageProperties properties = new FileStorageProperties(
            storageDirectory.toString(), 1024, List.of("png"), Duration.ofHours(24));
        return new TemporaryFileCleanupService(fileResourceDao, properties);
    }

    private FileResourceRow row(Long fileId, Path storagePath) {
        FileResourceRow row = new FileResourceRow();
        row.setFileId(fileId);
        row.setStoragePath(storagePath.toString());
        row.setFileStatus("TEMP");
        return row;
    }
}
