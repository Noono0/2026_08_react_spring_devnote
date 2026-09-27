package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.crawler.dto.CrawlerSessionStatusResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;

@Component
public class CrawlerSessionStore {
    private static final String NAVER_SESSION_FILE = "naver.json";
    private final Path sessionDirectory;

    public CrawlerSessionStore(@Value("${CRAWLER_SESSION_ROOT:${application.file-storage.root-directory:./storage}}") String storageRoot) {
        this.sessionDirectory = Path.of(storageRoot).toAbsolutePath().normalize().resolve("crawler-sessions");
    }

    public Optional<String> readNaverSession() {
        Path sessionFile = naverSessionFile();
        if (!Files.isRegularFile(sessionFile)) return Optional.empty();
        try {
            String storageState = Files.readString(sessionFile, StandardCharsets.UTF_8);
            return storageState.isBlank() ? Optional.empty() : Optional.of(storageState);
        } catch (IOException exception) {
            throw storageFailure("저장된 네이버 로그인 세션을 읽지 못했습니다.");
        }
    }

    public void saveNaverSession(String storageState) {
        try {
            Files.createDirectories(sessionDirectory);
            Path temporaryFile = Files.createTempFile(sessionDirectory, "naver-", ".tmp");
            Files.writeString(temporaryFile, storageState, StandardCharsets.UTF_8);
            restrictToCurrentUser(temporaryFile);
            Files.move(temporaryFile, naverSessionFile(), StandardCopyOption.REPLACE_EXISTING);
            restrictToCurrentUser(naverSessionFile());
        } catch (IOException exception) {
            throw storageFailure("네이버 로그인 세션을 저장하지 못했습니다.");
        }
    }

    public CrawlerSessionStatusResponse status() {
        Path sessionFile = naverSessionFile();
        if (!Files.isRegularFile(sessionFile)) return new CrawlerSessionStatusResponse(false, null);
        try {
            return new CrawlerSessionStatusResponse(true, Files.getLastModifiedTime(sessionFile).toInstant());
        } catch (IOException exception) {
            throw storageFailure("저장된 네이버 로그인 세션 상태를 확인하지 못했습니다.");
        }
    }

    public void deleteNaverSession() {
        try {
            Files.deleteIfExists(naverSessionFile());
        } catch (IOException exception) {
            throw storageFailure("저장된 네이버 로그인 세션을 삭제하지 못했습니다.");
        }
    }

    private Path naverSessionFile() {
        return sessionDirectory.resolve(NAVER_SESSION_FILE).normalize();
    }

    private void restrictToCurrentUser(Path file) {
        try {
            Files.setPosixFilePermissions(file, Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
        } catch (UnsupportedOperationException | IOException ignored) {
            // Windows에서는 POSIX 권한을 지원하지 않으며 상위 폴더의 사용자 권한을 사용합니다.
        }
    }

    private BusinessException storageFailure(String message) {
        return new BusinessException(ErrorCode.CRAWLER_CONFIGURATION_INVALID, message);
    }
}
