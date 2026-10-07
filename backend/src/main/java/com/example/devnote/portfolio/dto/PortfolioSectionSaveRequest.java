package com.example.devnote.portfolio.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

/**
 * 섹션 추가·수정 요청 본문.
 *   current = true(진행 중)이면 종료일을 비워야 한다. 날짜 앞뒤 관계와 링크 형식(http/https)은 Service가 검사한다.
 *   editorImageFileIds: 본문에 들어간 이미지 파일 번호들(최대 30개). 저장할 때 섹션과 연결되고 ACTIVE가 된다.
 *   versionNumber     : 수정할 때 필수(낙관적 잠금). 생성 때는 비운다.
 */
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
    @Positive Long versionNumber,
    // 아래 네 값은 PROJECT 섹션에서만 저장한다. 다른 섹션에서는 무시한다.
    @Size(max = 15, message = "기술 스택은 15개까지 입력할 수 있습니다.")
    List<@NotBlank @Size(max = 30, message = "기술 스택 이름은 30자 이하여야 합니다.") String> techStack,
    @Size(max = 300) String roleSummary,
    @Size(max = 1000) String repositoryUrl,
    @Size(max = 1000) String demoUrl
) {
    /** 이미지 목록을 보내지 않았으면(null) 빈 목록으로 바꿔 Service가 null 검사 없이 쓰게 한다. */
    public List<Long> normalizedEditorImageFileIds() {
        return editorImageFileIds == null ? List.of() : editorImageFileIds;
    }
}

