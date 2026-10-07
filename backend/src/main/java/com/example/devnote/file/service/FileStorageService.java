package com.example.devnote.file.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.file.config.FileStorageProperties;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.file.dao.parameter.FileCreateParameter;
import com.example.devnote.file.dao.row.FileResourceRow;
import com.example.devnote.file.dto.FileUploadResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 업로드 파일을 검사·저장하고, 저장된 파일을 다시 꺼내 주는 서비스입니다.
 *
 * [업로드 파일은 "믿을 수 없는 입력"이다 — 이 클래스가 하는 검사]
 *   1. 빈 파일·크기 초과 거부
 *   2. 파일 이름에 ../ 같은 경로 문자가 있으면 거부(서버의 다른 폴더에 쓰는 공격 방지)
 *   3. 확장자 허용 목록(설정 + 아래 MIME 표)에 없는 형식 거부
 *   4. 이미지 업로드는 파일 앞부분 바이트(시그니처)까지 확인 — 이름만 .png로 바꾼 파일을 걸러 낸다
 *   5. 디스크에는 사용자가 정한 이름이 아니라 무작위 UUID 이름으로 저장
 */
@Service
@RequiredArgsConstructor
public class FileStorageService {
    // 확장자 → MIME 타입 표. 브라우저가 보낸 Content-Type은 바꿔 보낼 수 있어 믿지 않고, 서버가 확장자로 정한다.
    private static final Map<String, String> MIME_TYPE_BY_EXTENSION = Map.ofEntries(
        Map.entry("png", "image/png"),
        Map.entry("jpg", "image/jpeg"),
        Map.entry("jpeg", "image/jpeg"),
        Map.entry("gif", "image/gif"),
        Map.entry("webp", "image/webp"),
        Map.entry("pdf", "application/pdf"),
        Map.entry("txt", "text/plain"),
        Map.entry("csv", "text/csv"),
        Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
        Map.entry("zip", "application/zip")
    );
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");

    private final FileStorageProperties properties;
    private final FileResourceDao fileResourceDao;

    @Transactional
    public FileUploadResponse uploadFile(MultipartFile multipartFile, Long uploaderId) {
        return storeFile(multipartFile, uploaderId, false);
    }

    @Transactional
    public FileUploadResponse uploadImageFile(MultipartFile multipartFile, Long uploaderId) {
        return storeFile(multipartFile, uploaderId, true);
    }

    private FileUploadResponse storeFile(MultipartFile multipartFile, Long uploaderId, boolean imageOnly) {
        ValidatedFile validatedFile = validateFile(multipartFile, imageOnly);
        // 저장 이름 = 무작위 32글자 + 확장자. 같은 이름의 파일이 와도 덮어쓰지 않는다.
        String storedFileName = UUID.randomUUID().toString().replace("-", "")
            + "." + validatedFile.fileExtension();
        // normalize(): 경로 안의 ./ ../ 를 계산해 정리한다.
        Path storageDirectory = Path.of(properties.rootDirectory()).toAbsolutePath().normalize();
        Path storedFilePath = storageDirectory.resolve(storedFileName).normalize();

        // 최종 경로가 저장 폴더 바깥이면 거부한다(경로 조작 방어를 한 번 더).
        if (!storedFilePath.startsWith(storageDirectory)) {
            throw new BusinessException(ErrorCode.FILE_STORAGE_FAILED);
        }

        try {
            Files.createDirectories(storageDirectory);
            Files.copy(multipartFile.getInputStream(), storedFilePath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new BusinessException(ErrorCode.FILE_STORAGE_FAILED);
        }

        FileCreateParameter parameter = new FileCreateParameter();
        parameter.setUploaderId(uploaderId);
        parameter.setOriginalFileName(validatedFile.originalFileName());
        parameter.setStoredFileName(storedFileName);
        parameter.setFileExtension(validatedFile.fileExtension());
        parameter.setMimeType(validatedFile.mimeType());
        parameter.setFileSize(multipartFile.getSize());
        parameter.setStoragePath(storedFilePath.toString());
        // 아직 어느 문서에도 연결되지 않았으므로 TEMP. 문서를 저장하면 ACTIVE가 된다.
        parameter.setFileStatus("TEMP");

        try {
            fileResourceDao.insertFile(parameter);
        // 디스크에는 썼는데 DB 기록이 실패하면, 아무도 찾지 못하는 파일이 남지 않도록 방금 쓴 파일을 지운 뒤 오류를 그대로 던진다.
        } catch (RuntimeException databaseException) {
            deleteQuietly(storedFilePath);
            throw databaseException;
        }

        String contentUrl = IMAGE_EXTENSIONS.contains(validatedFile.fileExtension())
            ? "/api/v1/files/" + parameter.getFileId() + "/content"
            : null;

        return new FileUploadResponse(
            parameter.getFileId(),
            validatedFile.originalFileName(),
            validatedFile.fileExtension(),
            validatedFile.mimeType(),
            parameter.getFileSize(),
            parameter.getFileStatus(),
            "/api/v1/files/" + parameter.getFileId() + "/download",
            contentUrl
        );
    }

    /** 다운로드: 삭제되지 않은 파일이면 형식과 관계없이 내려준다. */
    @Transactional(readOnly = true)
    public DownloadedFile downloadFile(Long fileId) {
        return loadDownloadedFile(fileId, false);
    }

    /** 이미지 보기: 이미지가 아니면 거부한다(<img src>로 다른 형식이 열리는 것을 막는다). */
    @Transactional(readOnly = true)
    public DownloadedFile displayImageContent(Long fileId) {
        return loadDownloadedFile(fileId, true);
    }

    private DownloadedFile loadDownloadedFile(Long fileId, boolean imageOnly) {
        FileResourceRow fileResource = fileResourceDao.selectFileById(fileId);
        if (fileResource == null || "DELETED".equals(fileResource.getFileStatus())) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        if (imageOnly && (fileResource.getMimeType() == null || !fileResource.getMimeType().startsWith("image/"))) {
            throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
        }
        try {
            // 디스크 경로를 Spring의 Resource로 감싼다. Controller가 이 Resource를 응답 본문으로 흘려보낸다.
            Resource resource = new UrlResource(Path.of(fileResource.getStoragePath()).toUri());
            // DB에는 기록이 있지만 디스크 파일이 지워진 경우도 404로 처리한다.
            if (!resource.exists() || !resource.isReadable()) {
                throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
            }
            return new DownloadedFile(resource, fileResource.getOriginalFileName(), fileResource.getMimeType());
        } catch (MalformedURLException exception) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
    }

    private ValidatedFile validateFile(MultipartFile multipartFile, boolean imageOnly) {
        if (multipartFile.isEmpty()) {
            throw new BusinessException(ErrorCode.FILE_EMPTY);
        }
        if (multipartFile.getSize() > properties.maximumFileSizeBytes()) {
            throw new BusinessException(ErrorCode.FILE_SIZE_EXCEEDED);
        }

        String rawOriginalFileName = multipartFile.getOriginalFilename();
        if (!StringUtils.hasText(rawOriginalFileName)) {
            throw new BusinessException(ErrorCode.FILE_EXTENSION_NOT_ALLOWED);
        }
        // cleanPath: 경로 구분자(\ → /)와 ./ 등을 정리한 뒤, 아래에서 경로 문자가 남아 있는지 검사한다.
        String originalFileName = StringUtils.cleanPath(rawOriginalFileName);
        if (originalFileName.contains("..") || originalFileName.contains("/") || originalFileName.contains("\\")) {
            throw new BusinessException(ErrorCode.FILE_EXTENSION_NOT_ALLOWED, "안전하지 않은 파일명입니다.");
        }

        String extension = extractExtension(originalFileName);
        // 설정의 허용 목록에 있고, MIME 표에도 있는 확장자만 통과한다(둘 다 만족해야 함).
        boolean extensionAllowed = properties.allowedExtensions().stream()
            .map(value -> value.toLowerCase(Locale.ROOT))
            .anyMatch(extension::equals);
        if (!extensionAllowed || !MIME_TYPE_BY_EXTENSION.containsKey(extension)) {
            throw new BusinessException(
                ErrorCode.FILE_EXTENSION_NOT_ALLOWED,
                "업로드할 수 없는 파일 형식입니다: ." + extension
            );
        }
        if (imageOnly && !IMAGE_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
        }
        if (imageOnly) {
            validateImageSignature(multipartFile, extension);
        }

        return new ValidatedFile(originalFileName, extension, MIME_TYPE_BY_EXTENSION.get(extension));
    }

    /**
     * 파일의 처음 12바이트("매직 넘버")로 실제 이미지 형식인지 확인한다.
     *   PNG : 89 50 4E 47 0D 0A 1A 0A   JPEG: FF D8 FF
     *   GIF : "GIF87a" 또는 "GIF89a"     WEBP: "RIFF" + (4바이트 크기) + "WEBP"
     * try-with-resources: 괄호 안에서 연 InputStream을 블록이 끝나면 자동으로 닫는다.
     */
    private void validateImageSignature(MultipartFile multipartFile, String extension) {
        try (InputStream inputStream = multipartFile.getInputStream()) {
            byte[] header = inputStream.readNBytes(12);
            boolean valid = switch (extension) {
                case "png" -> startsWith(header, new int[] {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
                case "jpg", "jpeg" -> startsWith(header, new int[] {0xFF, 0xD8, 0xFF});
                case "gif" -> startsWithAscii(header, "GIF87a") || startsWithAscii(header, "GIF89a");
                case "webp" -> startsWithAscii(header, "RIFF") && hasAsciiAt(header, 8, "WEBP");
                default -> false;
            };
            if (!valid) {
                throw new BusinessException(ErrorCode.FILE_NOT_IMAGE, "파일 내용이 올바른 이미지 형식이 아닙니다.");
            }
        } catch (IOException exception) {
            throw new BusinessException(ErrorCode.FILE_STORAGE_FAILED);
        }
    }

    /**
     * Java의 byte는 -128~127이라 0xFF 같은 값이 음수로 저장된다.
     * Byte.toUnsignedInt로 0~255로 바꾼 뒤 비교해야 16진수 표의 값과 맞는다.
     */
    private boolean startsWith(byte[] source, int[] expectedUnsignedBytes) {
        if (source.length < expectedUnsignedBytes.length) {
            return false;
        }
        for (int index = 0; index < expectedUnsignedBytes.length; index++) {
            if (Byte.toUnsignedInt(source[index]) != expectedUnsignedBytes[index]) {
                return false;
            }
        }
        return true;
    }

    private boolean startsWithAscii(byte[] source, String expectedText) {
        return hasAsciiAt(source, 0, expectedText);
    }

    private boolean hasAsciiAt(byte[] source, int offset, String expectedText) {
        byte[] expectedBytes = expectedText.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        if (source.length < offset + expectedBytes.length) {
            return false;
        }
        for (int index = 0; index < expectedBytes.length; index++) {
            if (source[offset + index] != expectedBytes[index]) {
                return false;
            }
        }
        return true;
    }

    /** 마지막 점 뒤의 글자를 소문자로 꺼낸다(photo.backup.PNG → png). 점이 없거나 점으로 끝나면 거부한다. */
    private String extractExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            throw new BusinessException(ErrorCode.FILE_EXTENSION_NOT_ALLOWED);
        }
        return fileName.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // DB 오류를 우선 전달하고, 삭제 실패는 운영 로그/정리 배치에서 다룹니다.
        }
    }

    /** 검사를 통과한 파일 정보(이 클래스 안에서만 쓰는 작은 묶음). */
    private record ValidatedFile(String originalFileName, String fileExtension, String mimeType) {
    }

    /** Controller에 넘겨줄 파일 내용과 응답 헤더용 정보(원래 이름, MIME 타입). */
    public record DownloadedFile(Resource resource, String originalFileName, String mimeType) {
    }
}
