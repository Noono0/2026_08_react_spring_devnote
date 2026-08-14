package com.example.devnote.document.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record DocumentCreateRequest(
    @NotBlank(message = "문서 제목은 필수입니다.")
    @Size(max = 200, message = "문서 제목은 200자 이하여야 합니다.")
    String documentTitle,

    Long thumbnailFileId,

    @Size(max = 20, message = "첨부파일은 최대 20개까지 등록할 수 있습니다.")
    List<Long> attachmentFileIds,

    @NotNull(message = "문서 내용 JSON은 필수입니다.")
    JsonNode contentJson,

    @NotBlank(message = "문서 HTML은 필수입니다.")
    String contentHtml,

    @NotBlank(message = "검색용 텍스트는 필수입니다.")
    String contentText,

    @NotNull(message = "문서 상태는 필수입니다.")
    DocumentStatus documentStatus
) {
    public List<Long> normalizedAttachmentFileIds() {
        return attachmentFileIds == null ? List.of() : attachmentFileIds;
    }
}
