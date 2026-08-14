package com.example.devnote.portfolio.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

public record PortfolioSectionSaveRequest(
    @NotNull PortfolioSectionType sectionType,
    @NotNull PortfolioContentMode contentMode,
    @NotBlank(message = "제목을 입력해 주세요.") @Size(max = 120) String sectionTitle,
    @Size(max = 200) String sectionSubtitle,
    LocalDate startDate,
    LocalDate endDate,
    boolean current,
    @Size(max = 1000) String externalUrl,
    @Positive Long thumbnailFileId,
    @NotNull JsonNode contentJson,
    @NotNull String contentHtml,
    @NotNull String contentText,
    @Size(max = 30) String layoutType,
    @Min(0) @Max(10000) int sortOrder,
    @NotNull PortfolioVisibility visibility,
    List<@Positive Long> editorImageFileIds,
    @Positive Long versionNumber
) {
    public List<Long> normalizedEditorImageFileIds() {
        return editorImageFileIds == null ? List.of() : editorImageFileIds;
    }
}

