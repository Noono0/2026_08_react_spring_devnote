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

@Service
@RequiredArgsConstructor
public class FileStorageService {
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
        String storedFileName = UUID.randomUUID().toString().replace("-", "")
            + "." + validatedFile.fileExtension();
        Path storageDirectory = Path.of(properties.rootDirectory()).toAbsolutePath().normalize();
        Path storedFilePath = storageDirectory.resolve(storedFileName).normalize();

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
        parameter.setFileStatus("TEMP");

        try {
            fileResourceDao.insertFile(parameter);
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

    @Transactional(readOnly = true)
    public DownloadedFile downloadFile(Long fileId) {
        return loadDownloadedFile(fileId, false);
    }

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
            Resource resource = new UrlResource(Path.of(fileResource.getStoragePath()).toUri());
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
        String originalFileName = StringUtils.cleanPath(rawOriginalFileName);
        if (originalFileName.contains("..") || originalFileName.contains("/") || originalFileName.contains("\\")) {
            throw new BusinessException(ErrorCode.FILE_EXTENSION_NOT_ALLOWED, "안전하지 않은 파일명입니다.");
        }

        String extension = extractExtension(originalFileName);
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

    private record ValidatedFile(String originalFileName, String fileExtension, String mimeType) {
    }

    public record DownloadedFile(Resource resource, String originalFileName, String mimeType) {
    }
}
