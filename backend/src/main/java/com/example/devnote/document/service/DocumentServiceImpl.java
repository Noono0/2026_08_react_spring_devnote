package com.example.devnote.document.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dao.DocumentDao;
import com.example.devnote.document.dao.parameter.DocumentCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentHistoryCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentUpdateParameter;
import com.example.devnote.document.dao.row.DocumentDetailRow;
import com.example.devnote.document.dto.DocumentCreateRequest;
import com.example.devnote.document.dto.DocumentDetailResponse;
import com.example.devnote.document.dto.DocumentHistoryResponse;
import com.example.devnote.document.dto.DocumentListItemResponse;
import com.example.devnote.document.dto.DocumentSearchCondition;
import com.example.devnote.document.dto.DocumentScope;
import com.example.devnote.document.dto.DocumentUpdateRequest;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.document.exception.DocumentEditForbiddenException;
import com.example.devnote.document.exception.DocumentNotFoundException;
import com.example.devnote.document.exception.DocumentVersionConflictException;
import com.example.devnote.file.dao.FileResourceDao;
import com.example.devnote.file.dao.row.FileResourceRow;
import com.example.devnote.file.dto.DocumentAttachmentResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DocumentServiceImpl implements DocumentService {
    private static final int MAXIMUM_ATTACHMENT_COUNT = 20;

    private final DocumentDao documentDao;
    private final FileResourceDao fileResourceDao;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public DocumentDetailResponse createDocument(DocumentCreateRequest request, Long memberId) {
        return createDocument(request, memberId, DocumentScope.PRACTICE);
    }

    @Override
    @Transactional
    public DocumentDetailResponse createDocument(DocumentCreateRequest request, Long memberId, DocumentScope documentScope) {
        List<Long> attachmentFileIds = normalizeAttachmentFileIds(request.normalizedAttachmentFileIds());
        validateThumbnailFile(request.thumbnailFileId(), memberId);
        validateAttachmentFiles(attachmentFileIds, memberId);

        DocumentCreateParameter parameter = new DocumentCreateParameter();
        parameter.setMemberId(memberId);
        parameter.setThumbnailFileId(request.thumbnailFileId());
        parameter.setDocumentTitle(request.documentTitle());
        parameter.setDocumentScope(documentScope.name());
        parameter.setContentJson(writeJson(request.contentJson()));
        parameter.setContentHtml(request.contentHtml());
        parameter.setContentText(request.contentText());
        parameter.setDocumentStatus(request.documentStatus().name());
        documentDao.insertDocument(parameter);

        synchronizeDocumentAttachments(parameter.getDocumentId(), attachmentFileIds, memberId);
        activateFileWhenPresent(request.thumbnailFileId(), memberId);
        return getDocumentDetail(parameter.getDocumentId(), documentScope);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DocumentListItemResponse> getDocumentList(DocumentSearchCondition condition) {
        normalizeSearchCondition(condition);
        List<DocumentListItemResponse> content = documentDao.selectDocumentList(condition);
        long totalElements = documentDao.countDocumentList(condition);
        return PageResponse.of(content, condition.getPageNumber(), condition.getPageSize(), totalElements);
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentDetailResponse getDocumentDetail(Long documentId) {
        return getDocumentDetail(documentId, DocumentScope.PRACTICE);
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentDetailResponse getDocumentDetail(Long documentId, DocumentScope documentScope) {
        return toResponse(getRequiredDocument(documentId, documentScope));
    }

    @Override
    @Transactional
    public DocumentDetailResponse updateDocument(Long documentId, DocumentUpdateRequest request, Long memberId) {
        return updateDocument(documentId, request, memberId, DocumentScope.PRACTICE);
    }

    @Override
    @Transactional
    public DocumentDetailResponse updateDocument(Long documentId, DocumentUpdateRequest request, Long memberId, DocumentScope documentScope) {
        DocumentDetailRow existingDocument = getRequiredDocument(documentId, documentScope);
        validateOwner(existingDocument, memberId);

        List<Long> attachmentFileIds = normalizeAttachmentFileIds(request.normalizedAttachmentFileIds());
        validateThumbnailFile(request.thumbnailFileId(), memberId);
        validateAttachmentFiles(attachmentFileIds, memberId);

        DocumentHistoryCreateParameter historyCreateParameter = DocumentHistoryCreateParameter.builder()
            .documentId(documentId)
            .versionNumber(existingDocument.getVersionNumber())
            .thumbnailFileId(existingDocument.getThumbnailFileId())
            .documentTitle(existingDocument.getDocumentTitle())
            .documentStatus(existingDocument.getDocumentStatus())
            .contentJson(existingDocument.getContentJson())
            .contentHtml(existingDocument.getContentHtml())
            .contentText(existingDocument.getContentText())
            .changeSummary(request.changeSummary())
            .changedBy(memberId)
            .build();

        /*
         * 낙관적 잠금 UPDATE를 먼저 실행합니다.
         * stale 버전이면 0건이 수정되어 곧바로 409를 반환하므로, 동일 버전 이력이
         * 중복 INSERT되어 DB 제약조건 오류가 나는 상황을 피할 수 있습니다.
         */
        int updatedRowCount = documentDao.updateDocument(DocumentUpdateParameter.builder()
            .documentId(documentId)
            .memberId(memberId)
            .thumbnailFileId(request.thumbnailFileId())
            .documentTitle(request.documentTitle())
            .contentJson(writeJson(request.contentJson()))
            .contentHtml(request.contentHtml())
            .contentText(request.contentText())
            .documentStatus(request.documentStatus().name())
            .documentScope(documentScope.name())
            .versionNumber(request.versionNumber())
            .build());

        if (updatedRowCount == 0) {
            throw new DocumentVersionConflictException();
        }

        /*
         * UPDATE가 성공한 뒤 이전 스냅샷을 이력으로 저장합니다.
         * 이력 저장 실패 시 같은 트랜잭션의 UPDATE도 함께 롤백됩니다.
         */
        documentDao.insertDocumentHistory(historyCreateParameter);
        synchronizeDocumentAttachments(documentId, attachmentFileIds, memberId);
        activateFileWhenPresent(request.thumbnailFileId(), memberId);
        return getDocumentDetail(documentId, documentScope);
    }

    @Override
    @Transactional
    public void deleteDocument(Long documentId, Long memberId) {
        deleteDocument(documentId, memberId, DocumentScope.PRACTICE);
    }

    @Override
    @Transactional
    public void deleteDocument(Long documentId, Long memberId, DocumentScope documentScope) {
        DocumentDetailRow existingDocument = getRequiredDocument(documentId, documentScope);
        validateOwner(existingDocument, memberId);
        if (documentDao.softDeleteDocument(documentId, memberId, documentScope.name()) == 0) {
            throw new DocumentNotFoundException();
        }
    }

    @Override
    @Transactional
    public void restoreDocument(Long documentId, Long memberId) {
        DocumentDetailRow existingDocument = getRequiredDocumentIncludingDeleted(documentId, DocumentScope.PRACTICE);
        validateOwner(existingDocument, memberId);
        if (documentDao.restoreDocument(documentId, memberId, DocumentScope.PRACTICE.name()) == 0) {
            throw new DocumentNotFoundException();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentHistoryResponse> getDocumentHistories(Long documentId) {
        getRequiredDocumentIncludingDeleted(documentId, DocumentScope.PRACTICE);
        return documentDao.selectDocumentHistories(documentId);
    }

    private DocumentDetailRow getRequiredDocument(Long documentId, DocumentScope documentScope) {
        DocumentDetailRow document = getRequiredDocumentIncludingDeleted(documentId, documentScope);
        if (!"Y".equals(document.getUseYn())) {
            throw new DocumentNotFoundException();
        }
        return document;
    }

    private DocumentDetailRow getRequiredDocumentIncludingDeleted(Long documentId, DocumentScope documentScope) {
        DocumentDetailRow document = documentDao.selectDocumentById(documentId);
        if (document == null || !documentScope.name().equals(document.getDocumentScope())) {
            throw new DocumentNotFoundException();
        }
        return document;
    }

    private void validateOwner(DocumentDetailRow document, Long memberId) {
        if (!document.getAuthorId().equals(memberId)) {
            throw new DocumentEditForbiddenException();
        }
    }

    private DocumentDetailResponse toResponse(DocumentDetailRow row) {
        try {
            List<DocumentAttachmentResponse> attachmentFiles =
                documentDao.selectDocumentAttachments(row.getDocumentId());
            return new DocumentDetailResponse(
                row.getDocumentId(),
                row.getAuthorId(),
                row.getAuthorName(),
                row.getDocumentTitle(),
                objectMapper.readTree(row.getContentJson()),
                row.getContentHtml(),
                row.getContentText(),
                row.getThumbnailFileId(),
                row.getThumbnailImageUrl(),
                attachmentFiles,
                row.getDocumentStatus(),
                row.getVersionNumber(),
                row.getViewCount(),
                row.getCreatedAt(),
                row.getUpdatedAt()
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DB에 저장된 contentJson을 읽을 수 없습니다.", exception);
        }
    }

    private String writeJson(JsonNode jsonNode) {
        try {
            return objectMapper.writeValueAsString(jsonNode);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("contentJson을 JSON 문자열로 변환할 수 없습니다.", exception);
        }
    }

    /**
     * 대표 이미지로 지정한 파일이 현재 사용자가 올린 이미지인지 확인합니다.
     * DB 외래 키 오류를 그대로 노출하지 않고 기능별 오류 코드를 반환하기 위한 검증입니다.
     */
    private void validateThumbnailFile(Long thumbnailFileId, Long memberId) {
        if (thumbnailFileId == null) {
            return;
        }
        FileResourceRow thumbnailFile = getUsableOwnedFile(thumbnailFileId, memberId);
        if (thumbnailFile.getMimeType() == null || !thumbnailFile.getMimeType().startsWith("image/")) {
            throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
        }
    }

    private void validateAttachmentFiles(List<Long> attachmentFileIds, Long memberId) {
        if (attachmentFileIds.size() > MAXIMUM_ATTACHMENT_COUNT) {
            throw new BusinessException(
                ErrorCode.COMMON_INVALID_REQUEST,
                "첨부파일은 최대 " + MAXIMUM_ATTACHMENT_COUNT + "개까지 등록할 수 있습니다."
            );
        }
        attachmentFileIds.forEach(fileId -> getUsableOwnedFile(fileId, memberId));
    }

    private FileResourceRow getUsableOwnedFile(Long fileId, Long memberId) {
        FileResourceRow fileResource = fileResourceDao.selectFileById(fileId);
        if (fileResource == null || "DELETED".equals(fileResource.getFileStatus())) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        if (!memberId.equals(fileResource.getUploaderId())) {
            throw new BusinessException(ErrorCode.FILE_ACCESS_FORBIDDEN);
        }
        return fileResource;
    }

    private List<Long> normalizeAttachmentFileIds(List<Long> attachmentFileIds) {
        return new LinkedHashSet<>(attachmentFileIds).stream()
            .filter(fileId -> fileId != null && fileId > 0)
            .toList();
    }

    private void synchronizeDocumentAttachments(Long documentId, List<Long> attachmentFileIds, Long memberId) {
        documentDao.deleteDocumentAttachments(documentId);
        for (int attachmentIndex = 0; attachmentIndex < attachmentFileIds.size(); attachmentIndex++) {
            Long fileId = attachmentFileIds.get(attachmentIndex);
            documentDao.insertDocumentAttachment(documentId, fileId, attachmentIndex);
            activateFileWhenPresent(fileId, memberId);
        }
    }

    private void activateFileWhenPresent(Long fileId, Long memberId) {
        if (fileId == null) {
            return;
        }

        FileResourceRow fileResource = getUsableOwnedFile(fileId, memberId);
        if ("ACTIVE".equals(fileResource.getFileStatus())) {
            return;
        }

        if (fileResourceDao.updateFileStatus(fileId, memberId, "ACTIVE") == 0) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
    }

    private void normalizeSearchCondition(DocumentSearchCondition condition) {
        if (condition.getSearchType() == null
            || !List.of("TITLE", "CONTENT", "TITLE_CONTENT", "AUTHOR").contains(condition.getSearchType())) {
            condition.setSearchType("TITLE_CONTENT");
        }
        if (condition.getSortProperty() == null
            || !List.of("CREATED_AT", "UPDATED_AT", "VIEW_COUNT", "TITLE").contains(condition.getSortProperty())) {
            condition.setSortProperty("UPDATED_AT");
        }
        if (condition.getSortDirection() == null
            || !List.of("ASC", "DESC").contains(condition.getSortDirection().toUpperCase())) {
            condition.setSortDirection("DESC");
        } else {
            condition.setSortDirection(condition.getSortDirection().toUpperCase());
        }
        if (condition.getSearchKeyword() == null) {
            condition.setSearchKeyword("");
        }
    }
}
