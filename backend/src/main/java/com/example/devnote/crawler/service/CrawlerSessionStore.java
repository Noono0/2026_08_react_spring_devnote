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

/**
 * 네이버 로그인 세션(Playwright storageState JSON = 쿠키·로컬 저장소)을 파일로 보관합니다.
 * 세션은 crawlerSessionLogin 도구로 사람이 직접 로그인해 만든다. 크롤러는 이 파일을 불러와 로그인된 상태로 시작한다.
 *
 * ★ 이 파일은 사실상 "로그인 열쇠"다. 저장소 폴더(storage/crawler-sessions)는 Git·백업 공유 대상에서 빼고,
 *   Linux에서는 소유자만 읽고 쓸 수 있게 권한을 줄인다(restrictToCurrentUser).
 */
@Component
public class CrawlerSessionStore {
    private static final String NAVER_SESSION_FILE = "naver.json";
    private final Path sessionDirectory;

    // 저장 위치: CRAWLER_SESSION_ROOT 환경변수 → 없으면 파일 저장 루트(application.file-storage.root-directory) → 없으면 ./storage
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
            // 임시 파일에 다 쓴 뒤 이름을 바꿔 덮어쓴다(원자적 교체). 쓰는 도중 실패해도 기존 세션 파일이 반쯤 깨진 채 남지 않는다.
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
