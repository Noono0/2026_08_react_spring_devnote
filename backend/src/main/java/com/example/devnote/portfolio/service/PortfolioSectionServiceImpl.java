package com.example.devnote.portfolio.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.file.dao.row.FileResourceRow;
import com.example.devnote.portfolio.dao.PortfolioSectionDao;
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

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PortfolioSectionServiceImpl implements PortfolioSectionService {
    private static final long PORTFOLIO_OWNER_MEMBER_ID = 1L;
    private static final int MAXIMUM_EDITOR_IMAGE_COUNT = 30;
    private final PortfolioSectionDao portfolioSectionDao;
    private final FileResourceDao fileResourceDao;
    private final ObjectMapper objectMapper;

    @Override public List<PortfolioSectionResponse> getPublicSections() { return portfolioSectionDao.selectPublicSections().stream().map(this::toResponse).toList(); }
    @Override public List<PortfolioSectionResponse> getAllSections() { return portfolioSectionDao.selectAllSections().stream().map(this::toResponse).toList(); }

    @Override
    @Transactional
    public PortfolioSectionResponse createSection(PortfolioSectionSaveRequest request) {
        validateRequest(request, false);
        PortfolioSectionSaveParameter parameter = toParameter(null, request);
        portfolioSectionDao.insertSection(parameter);
        synchronizeFiles(parameter.getPortfolioSectionId(), request);
        return toResponse(getRequiredSection(parameter.getPortfolioSectionId()));
    }

    @Override
    @Transactional
    public PortfolioSectionResponse updateSection(Long id, PortfolioSectionSaveRequest request) {
        getRequiredSection(id);
        validateRequest(request, true);
        PortfolioSectionSaveParameter parameter = toParameter(id, request);
        if (portfolioSectionDao.updateSection(parameter) == 0) {
            throw new BusinessException(ErrorCode.PORTFOLIO_VERSION_CONFLICT);
        }
        synchronizeFiles(id, request);
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
        validateExternalUrl(request.externalUrl());
        List<Long> imageIds = normalizedImageIds(request);
        if (imageIds.size() > MAXIMUM_EDITOR_IMAGE_COUNT) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "본문 이미지는 최대 30개까지 사용할 수 있습니다.");
        }
        imageIds.forEach(this::validateOwnedImage);
        if (request.thumbnailFileId() != null) validateOwnedImage(request.thumbnailFileId());
    }

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

    private List<Long> normalizedImageIds(PortfolioSectionSaveRequest request) {
        return new LinkedHashSet<>(request.normalizedEditorImageFileIds()).stream().toList();
    }

    private void validateOwnedImage(Long fileId) {
        FileResourceRow file = fileResourceDao.selectFileById(fileId);
        if (file == null || "DELETED".equals(file.getFileStatus())) throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        if (!Long.valueOf(PORTFOLIO_OWNER_MEMBER_ID).equals(file.getUploaderId())) throw new BusinessException(ErrorCode.FILE_ACCESS_FORBIDDEN);
        if (file.getMimeType() == null || !file.getMimeType().startsWith("image/")) throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
    }

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

    private PortfolioSectionResponse toResponse(PortfolioSectionRow row) {
        try {
            return new PortfolioSectionResponse(row.getPortfolioSectionId(), PortfolioSectionType.valueOf(row.getSectionType()),
                PortfolioContentMode.valueOf(row.getContentMode()), row.getSectionTitle(), row.getSectionSubtitle(), row.getStartDate(),
                row.getEndDate(), "Y".equals(row.getCurrentYn()), row.getExternalUrl(), row.getThumbnailFileId(), row.getThumbnailImageUrl(),
                objectMapper.readTree(row.getContentJson()), row.getContentHtml(), row.getContentText(), row.getLayoutType(), row.getSortOrder(),
                PortfolioVisibility.valueOf(row.getVisibility()), row.getVersionNumber(), portfolioSectionDao.selectEditorImageFileIds(row.getPortfolioSectionId()),
                row.getCreatedAt(), row.getUpdatedAt());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("포트폴리오 contentJson을 읽을 수 없습니다.", exception);
        }
    }

    private String writeJson(com.fasterxml.jackson.databind.JsonNode contentJson) {
        try { return objectMapper.writeValueAsString(contentJson); }
        catch (JsonProcessingException exception) { throw new IllegalArgumentException("contentJson을 저장할 수 없습니다.", exception); }
    }

    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private void validateExternalUrl(String externalUrl) {
        if (externalUrl == null || externalUrl.isBlank()) return;
        try {
            URI uri = URI.create(externalUrl.trim());
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "외부 링크는 http 또는 https 주소만 사용할 수 있습니다.");
        }
    }
}
