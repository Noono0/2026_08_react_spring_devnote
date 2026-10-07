package com.example.devnote.file.dto;

/** 문서 상세의 첨부파일 한 개. downloadUrl은 SQL에서 /api/v1/files/{번호}/download 로 만든다. */
public record DocumentAttachmentResponse(
    Long fileId,
    String originalFileName,
    String mimeType,
    Long fileSize,
    String downloadUrl
) {
}
