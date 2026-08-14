package com.example.devnote.file.dto;

public record DocumentAttachmentResponse(
    Long fileId,
    String originalFileName,
    String mimeType,
    Long fileSize,
    String downloadUrl
) {
}
