package com.example.devnote.document.dto;

import com.example.devnote.file.dto.DocumentAttachmentResponse;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 문서 상세 응답. 프론트의 documentTypes.ts(DocumentDetail 타입·Zod 스키마)와 필드 이름이 같아야 한다.
 * contentJson이 JsonNode라서 응답 JSON에서 문자열("{...}")이 아니라 객체({...})로 나간다.
 * thumbnailImageUrl·attachmentFiles의 주소는 서버가 만들어 주므로, 프론트는 그대로 <img src>·다운로드 링크에 쓴다.
 */
public record DocumentDetailResponse(
    Long documentId,
    Long authorId,
    String authorName,
    String documentTitle,
    JsonNode contentJson,
    String contentHtml,
    String contentText,
    Long thumbnailFileId,
    String thumbnailImageUrl,
    List<DocumentAttachmentResponse> attachmentFiles,
    List<String> tags,
    String documentStatus,
    Long versionNumber,
    Long viewCount,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
