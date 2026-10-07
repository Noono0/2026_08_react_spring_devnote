package com.example.devnote.portfolio.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.file.dao.row.FileResourceRow;
import com.example.devnote.portfolio.dao.PortfolioSectionDao;
import com.example.devnote.portfolio.dao.parameter.PortfolioProjectDetailParameter;
import com.example.devnote.portfolio.dao.parameter.PortfolioSectionSaveParameter;
import com.example.devnote.portfolio.dao.row.PortfolioSectionRow;
import com.example.devnote.portfolio.dto.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * 포트폴리오 섹션의 추가·수정·삭제 규칙입니다.
 *
 *   1. 날짜·링크 검사: 종료일 ≥ 시작일, 진행 중이면 종료일 없음, 링크는 http/https만
 *   2. 이미지 검사: 포트폴리오 주인(1번 회원)이 올린, 삭제되지 않은 이미지만 사용(최대 30개)
 *   3. 낙관적 잠금: 수정·삭제는 화면이 읽은 버전과 같을 때만 → 다르면 409(PORTFOLIO_VERSION_CONFLICT)
 *   4. PROJECT 상세: PROJECT 섹션이면 기술 스택 등을 저장, 다른 종류로 바뀌면 지운다
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PortfolioSectionServiceImpl implements PortfolioSectionService {
    private static final long PORTFOLIO_OWNER_MEMBER_ID = 1L;
    private static final int MAXIMUM_EDITOR_IMAGE_COUNT = 30;
    private final PortfolioSectionDao portfolioSectionDao;
    private final FileResourceDao fileResourceDao;
    private final ObjectMapper objectMapper;

    // 공개 섹션만 / 숨김 포함 전체. DB 행을 응답 모양으로 바꿔(map) 목록으로 돌려준다.
    @Override public List<PortfolioSectionResponse> getPublicSections() { return portfolioSectionDao.selectPublicSections().stream().map(this::toResponse).toList(); }
    @Override public List<PortfolioSectionResponse> getAllSections() { return portfolioSectionDao.selectAllSections().stream().map(this::toResponse).toList(); }

    @Override
    @Transactional
    public PortfolioSectionResponse createSection(PortfolioSectionSaveRequest request) {
        validateRequest(request, false);
        // 생성이므로 번호(null)가 없다. INSERT 후 parameter에 새 번호가 채워진다.
        PortfolioSectionSaveParameter parameter = toParameter(null, request);
        portfolioSectionDao.insertSection(parameter);
        synchronizeFiles(parameter.getPortfolioSectionId(), request);
        synchronizeProjectDetail(parameter.getPortfolioSectionId(), request);
        return toResponse(getRequiredSection(parameter.getPortfolioSectionId()));
    }

    @Override
    @Transactional
    public PortfolioSectionResponse updateSection(Long id, PortfolioSectionSaveRequest request) {
        // 먼저 존재 여부를 확인해, "없는 섹션(404)"과 "버전 충돌(409)"을 구분해 알려 준다.
        getRequiredSection(id);
        validateRequest(request, true);
        PortfolioSectionSaveParameter parameter = toParameter(id, request);
        if (portfolioSectionDao.updateSection(parameter) == 0) {
            throw new BusinessException(ErrorCode.PORTFOLIO_VERSION_CONFLICT);
        }
        synchronizeFiles(id, request);
        synchronizeProjectDetail(id, request);
        return toResponse(getRequiredSection(id));
    }

    @Override
    @Transactional
    public void deleteSection(Long id, Long versionNumber) {
        getRequiredSection(id);
        if (versionNumber == null || portfolioSectionDao.softDeleteSection(id, versionNumber) == 0) {
            throw new BusinessException(ErrorCode.PORTFOLIO_VERSION_CONFLICT);
        }
    }

    private void validateRequest(PortfolioSectionSaveRequest request, boolean update) {
        if (update && request.versionNumber() == null) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "수정할 섹션 버전이 필요합니다.");
        }
        if (request.startDate() != null && request.endDate() != null && request.endDate().isBefore(request.startDate())) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "종료일은 시작일보다 빠를 수 없습니다.");
        }
        if (request.current() && request.endDate() != null) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "현재 진행 중인 항목에는 종료일을 입력할 수 없습니다.");
        }
        validateHttpUrl(request.externalUrl(), "외부 링크");
        validateHttpUrl(request.repositoryUrl(), "저장소 주소");
        validateHttpUrl(request.demoUrl(), "데모 주소");
        List<Long> imageIds = normalizedImageIds(request);
        if (imageIds.size() > MAXIMUM_EDITOR_IMAGE_COUNT) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "본문 이미지는 최대 30개까지 사용할 수 있습니다.");
        }
        imageIds.forEach(this::validateOwnedImage);
        if (request.thumbnailFileId() != null) validateOwnedImage(request.thumbnailFileId());
    }

    /** 본문 이미지 연결을 요청과 똑같이 맞춘다(기존 연결 삭제 → 순서대로 다시 연결 → 파일을 ACTIVE로). */
    private void synchronizeFiles(Long id, PortfolioSectionSaveRequest request) {
        portfolioSectionDao.deleteEditorImages(id);
        List<Long> imageIds = normalizedImageIds(request);
        for (int index = 0; index < imageIds.size(); index++) {
            Long fileId = imageIds.get(index);
            portfolioSectionDao.insertSectionFile(id, fileId, "EDITOR_IMAGE", index);
            activateFile(fileId);
        }
        if (request.thumbnailFileId() != null) activateFile(request.thumbnailFileId());
    }

    /** LinkedHashSet: 순서는 지키면서 같은 이미지 번호가 두 번 들어오면 하나만 남긴다. */
    private List<Long> normalizedImageIds(PortfolioSectionSaveRequest request) {
        return new LinkedHashSet<>(request.normalizedEditorImageFileIds()).stream().toList();
    }

    /** 파일이 있고, 포트폴리오 주인이 올렸고, 이미지인지 확인한다(남의 파일을 섹션에 붙이는 것 방지). */
    private void validateOwnedImage(Long fileId) {
        FileResourceRow file = fileResourceDao.selectFileById(fileId);
        if (file == null || "DELETED".equals(file.getFileStatus())) throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        if (!Long.valueOf(PORTFOLIO_OWNER_MEMBER_ID).equals(file.getUploaderId())) throw new BusinessException(ErrorCode.FILE_ACCESS_FORBIDDEN);
        if (file.getMimeType() == null || !file.getMimeType().startsWith("image/")) throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
    }

    /** TEMP 파일을 ACTIVE로 바꿔 임시 파일 정리 대상에서 뺀다. 이미 ACTIVE면 그대로 둔다. */
    private void activateFile(Long fileId) {
        validateOwnedImage(fileId);
        FileResourceRow file = fileResourceDao.selectFileById(fileId);
        if (!"ACTIVE".equals(file.getFileStatus()) && fileResourceDao.updateFileStatus(fileId, PORTFOLIO_OWNER_MEMBER_ID, "ACTIVE") == 0) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
    }

    private PortfolioSectionRow getRequiredSection(Long id) {
        PortfolioSectionRow row = portfolioSectionDao.selectSectionById(id);
        if (row == null || !"Y".equals(row.getUseYn())) throw new BusinessException(ErrorCode.PORTFOLIO_SECTION_NOT_FOUND);
        return row;
    }

    /**
     * 요청 → DB용 값. 이때 값도 정리한다:
     *   빈 부제목·링크는 null로, 진행 중이면 종료일을 null로, 배치(layoutType)가 비면 DEFAULT로.
     */
    private PortfolioSectionSaveParameter toParameter(Long id, PortfolioSectionSaveRequest request) {
        return PortfolioSectionSaveParameter.builder()
            .portfolioSectionId(id).sectionType(request.sectionType().name()).contentMode(request.contentMode().name())
            .sectionTitle(request.sectionTitle().trim()).sectionSubtitle(trimToNull(request.sectionSubtitle()))
            .startDate(request.startDate()).endDate(request.current() ? null : request.endDate()).currentYn(request.current() ? "Y" : "N")
            .externalUrl(trimToNull(request.externalUrl())).thumbnailFileId(request.thumbnailFileId())
            .contentJson(writeJson(request.contentJson())).contentHtml(request.contentHtml()).contentText(request.contentText())
            .layoutType(request.layoutType() == null || request.layoutType().isBlank() ? "DEFAULT" : request.layoutType())
            .sortOrder(request.sortOrder()).visibility(request.visibility().name()).versionNumber(request.versionNumber()).build();
    }

    /** DB 행 → 응답. 문자열로 저장된 종류·공개 여부를 enum으로, contentJson·기술 스택 JSON을 객체로 바꾼다. */
    private PortfolioSectionResponse toResponse(PortfolioSectionRow row) {
        try {
            PortfolioSectionType sectionType = PortfolioSectionType.valueOf(row.getSectionType());
            com.fasterxml.jackson.databind.JsonNode contentJson = objectMapper.readTree(row.getContentJson());
            return new PortfolioSectionResponse(row.getPortfolioSectionId(), sectionType,
                PortfolioContentMode.valueOf(row.getContentMode()), row.getSectionTitle(), row.getSectionSubtitle(), row.getStartDate(),
                row.getEndDate(), "Y".equals(row.getCurrentYn()), row.getExternalUrl(), row.getThumbnailFileId(), row.getThumbnailImageUrl(),
                contentJson, row.getContentHtml(), row.getContentText(), row.getLayoutType(), row.getSortOrder(),
                PortfolioVisibility.valueOf(row.getVisibility()), row.getVersionNumber(), portfolioSectionDao.selectEditorImageFileIds(row.getPortfolioSectionId()),
                row.getCreatedAt(), row.getUpdatedAt(),
                readTechStack(row.getTechStackJson()), row.getRoleSummary(), row.getRepositoryUrl(), row.getDemoUrl());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("포트폴리오 contentJson을 읽을 수 없습니다.", exception);
        }
    }

    private String writeJson(com.fasterxml.jackson.databind.JsonNode contentJson) {
        try { return objectMapper.writeValueAsString(contentJson); }
        catch (JsonProcessingException exception) { throw new IllegalArgumentException("contentJson을 저장할 수 없습니다.", exception); }
    }

    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    /** 화면에서 링크로 열리는 주소이므로 javascript: 같은 주소를 막고 http(s)만 허용한다. */
    private void validateHttpUrl(String url, String fieldLabel) {
        if (url == null || url.isBlank()) return;
        try {
            URI uri = URI.create(url.trim());
            // 주소 형식이 틀리면 URI.create가 IllegalArgumentException을 던지고, 아래 catch에서 같은 400 오류로 바꾼다.
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, fieldLabel + "는 http 또는 https 주소만 사용할 수 있습니다.");
        }
    }

    /**
     * PROJECT 섹션이면 기술 스택·역할·링크를 저장하고, 다른 종류면 남아 있던 상세 정보를 지운다.
     * 기술 스택은 앞뒤 공백을 지우고 대소문자를 무시한 중복을 한 번만 남긴다. (예: "React", "react " → "React")
     */
    private void synchronizeProjectDetail(Long id, PortfolioSectionSaveRequest request) {
        if (request.sectionType() != PortfolioSectionType.PROJECT) {
            portfolioSectionDao.deleteProjectDetail(id);
            return;
        }
        java.util.Map<String, String> uniqueTechStack = new java.util.LinkedHashMap<>();
        if (request.techStack() != null) {
            request.techStack().stream()
                .map(String::trim)
                .filter(name -> !name.isEmpty())
                .forEach(name -> uniqueTechStack.putIfAbsent(name.toLowerCase(java.util.Locale.ROOT), name));
        }
        try {
            portfolioSectionDao.upsertProjectDetail(PortfolioProjectDetailParameter.builder()
                .portfolioSectionId(id)
                .techStackJson(objectMapper.writeValueAsString(List.copyOf(uniqueTechStack.values())))
                .roleSummary(trimToNull(request.roleSummary()))
                .repositoryUrl(trimToNull(request.repositoryUrl()))
                .demoUrl(trimToNull(request.demoUrl()))
                .build());
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("기술 스택을 저장할 수 없습니다.", exception);
        }
    }

    /** 기술 스택 JSON 문자열 → List<String>. TypeReference는 제네릭 타입(List<String>)을 Jackson에 알려 주는 방법이다. */
    private List<String> readTechStack(String techStackJson) throws JsonProcessingException {
        if (techStackJson == null || techStackJson.isBlank()) return List.of();
        return objectMapper.readValue(techStackJson, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() { });
    }
}
