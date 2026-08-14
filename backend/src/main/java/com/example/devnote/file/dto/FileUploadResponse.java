package com.example.devnote.file.dto;

public record FileUploadResponse(
    Long fileId,
    String originalFileName,
    String fileExtension,
    String mimeType,
    Long fileSize,
    String fileStatus,
    String downloadUrl,
    String contentUrl
) {
}
