package com.example.devnote.document.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dao.DocumentDao;
import com.example.devnote.document.dao.parameter.DocumentCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentHistoryCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentUpdateParameter;
import com.example.devnote.document.dao.row.DocumentDetailRow;
import com.example.devnote.document.dao.row.DocumentTagRow;
import com.example.devnote.document.dto.DocumentCreateRequest;
import com.example.devnote.document.dto.DocumentDetailResponse;
import com.example.devnote.document.dto.DocumentHistoryResponse;
import com.example.devnote.document.dto.DocumentListItemResponse;
import com.example.devnote.document.dto.DocumentSearchCondition;
import com.example.devnote.document.dto.DocumentStatus;
import com.example.devnote.document.dto.DocumentTagCountResponse;
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

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.List;

/**
 * 문서 생성·조회·수정·삭제·복구의 업무 규칙을 담당합니다.
 *
 * [이 클래스가 지키는 규칙]
 *   1. 작성자만 수정·삭제·복구할 수 있다(validateOwner → 403).
 *   2. 낙관적 잠금: 화면이 읽었던 버전(versionNumber)과 DB 버전이 다르면 수정하지 않는다(→ 409).
 *   3. 수정할 때마다 "수정 전" 내용을 document_histories에 남긴다.
 *   4. 대표 이미지·첨부파일은 "내가 올린, 삭제되지 않은" 파일만 연결할 수 있다.
 *   5. 연결된 임시(TEMP) 파일은 ACTIVE로 바꿔 자동 정리 대상에서 뺀다(TemporaryFileCleanupService).
 *
 * [@Transactional] 메서드 안의 여러 SQL을 하나로 묶는다. 중간에 예외가 나면 앞의 SQL도 모두 취소(롤백)된다.
 *   readOnly = true: 조회 전용이라는 표시. DB와 JPA가 쓰기 준비를 생략해 조금 가벼워진다.
 */
@Service
@RequiredArgsConstructor
public class DocumentServiceImpl implements DocumentService {
    private static final int MAXIMUM_ATTACHMENT_COUNT = 20;

    private final DocumentDao documentDao;
    private final FileResourceDao fileResourceDao;
    // ObjectMapper(Jackson): Java 객체·JsonNode ↔ JSON 문자열 변환기. 에디터 본문(contentJson)을 저장·읽을 때 쓴다.
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public DocumentDetailResponse createDocument(DocumentCreateRequest request, Long memberId) {
        return createDocument(request, memberId, DocumentScope.PRACTICE);
    }

    @Override
    @Transactional
    public DocumentDetailResponse createDocument(DocumentCreateRequest request, Long memberId, DocumentScope documentScope) {
        // ① 입력 정리·검증: 첨부 번호의 중복·잘못된 값을 걸러 내고, 파일이 내 것인지 확인한다.
        List<Long> attachmentFileIds = normalizeAttachmentFileIds(request.normalizedAttachmentFileIds());
        validateThumbnailFile(request.thumbnailFileId(), memberId);
        validateAttachmentFiles(attachmentFileIds, memberId);

        // ② INSERT용 값 묶음을 만든다. 작성자(memberId)와 범위(documentScope)는 요청이 아니라 서버가 정한 값이다.
        DocumentCreateParameter parameter = new DocumentCreateParameter();
        parameter.setMemberId(memberId);
        parameter.setThumbnailFileId(request.thumbnailFileId());
        parameter.setDocumentTitle(request.documentTitle());
        parameter.setDocumentScope(documentScope.name());
        parameter.setContentJson(writeJson(request.contentJson()));
        parameter.setContentHtml(request.contentHtml());
        parameter.setContentText(request.contentText());
        parameter.setDocumentStatus(request.documentStatus().name());
        // INSERT가 끝나면 MyBatis가 새 문서 번호를 parameter.documentId에 채워 준다(useGeneratedKeys).
        documentDao.insertDocument(parameter);

        // ③ 새 번호로 첨부파일·태그를 연결하고, 대표 이미지를 ACTIVE로 바꾼다.
        synchronizeDocumentAttachments(parameter.getDocumentId(), attachmentFileIds, memberId);
        documentDao.insertDocumentTags(parameter.getDocumentId(), normalizeTags(request.normalizedTags()));
        activateFileWhenPresent(request.thumbnailFileId(), memberId);
        // ④ 저장된 결과(작성자 이름·버전 1 등 DB가 채운 값 포함)를 다시 읽어 돌려준다.
        return getDocumentDetail(parameter.getDocumentId(), documentScope);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DocumentListItemResponse> getDocumentList(DocumentSearchCondition condition) {
        // 잘못된 검색 조건(없는 정렬 기준 등)은 오류 대신 기본값으로 바꾼다.
        normalizeSearchCondition(condition);
        List<DocumentListItemResponse> documents = documentDao.selectDocumentList(condition);
        // 목록에 보이는 문서들의 태그를 한 번에 읽어 문서별로 묶는다.
        Map<Long, List<String>> tagsByDocumentId = documentDao.selectTagsByDocumentIds(
                documents.stream().map(DocumentListItemResponse::documentId).toList()).stream()
            .collect(Collectors.groupingBy(DocumentTagRow::getDocumentId, LinkedHashMap::new,
                Collectors.mapping(DocumentTagRow::getTagName, Collectors.toList())));
        List<DocumentListItemResponse> content = documents.stream()
            .map(document -> document.withTags(tagsByDocumentId.getOrDefault(document.documentId(), List.of())))
            .toList();
        // 같은 조건의 전체 건수: 화면이 "전체 몇 페이지인지"를 계산하는 데 쓴다.
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
        // ① 문서가 있는지(삭제·다른 범위면 404), 내가 작성자인지(아니면 403) 확인한다.
        DocumentDetailRow existingDocument = getRequiredDocument(documentId, documentScope);
        validateOwner(existingDocument, memberId);

        List<Long> attachmentFileIds = normalizeAttachmentFileIds(request.normalizedAttachmentFileIds());
        validateThumbnailFile(request.thumbnailFileId(), memberId);
        validateAttachmentFiles(attachmentFileIds, memberId);

        // ② 수정 "전" 내용을 이력용 값으로 미리 담아 둔다. UPDATE 뒤에는 이전 값이 사라지기 때문이다.
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

        // WHERE ... AND version_number = #{versionNumber} 조건에 맞는 행이 없으면 0건 → 그 사이 누군가 먼저 수정했다는 뜻.
        if (updatedRowCount == 0) {
            throw new DocumentVersionConflictException();
        }

        /*
         * UPDATE가 성공한 뒤 이전 스냅샷을 이력으로 저장합니다.
         * 이력 저장 실패 시 같은 트랜잭션의 UPDATE도 함께 롤백됩니다.
         */
        documentDao.insertDocumentHistory(historyCreateParameter);
        synchronizeDocumentAttachments(documentId, attachmentFileIds, memberId);
        // 태그는 "전부 지우고 다시 넣기" 방식으로 바꾼다. 무엇이 추가·삭제됐는지 비교하는 것보다 단순하다.
        documentDao.deleteDocumentTags(documentId);
        documentDao.insertDocumentTags(documentId, normalizeTags(request.normalizedTags()));
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
        // 위에서 확인했지만, 그 사이 다른 요청이 먼저 지웠다면 0건이 되므로 한 번 더 404로 알려 준다.
        if (documentDao.softDeleteDocument(documentId, memberId, documentScope.name()) == 0) {
            throw new DocumentNotFoundException();
        }
    }

    @Override
    @Transactional
    public void restoreDocument(Long documentId, Long memberId) {
        // 복구는 "삭제된 문서"가 대상이므로 삭제 여부와 관계없이 찾는다.
        DocumentDetailRow existingDocument = getRequiredDocumentIncludingDeleted(documentId, DocumentScope.PRACTICE);
        validateOwner(existingDocument, memberId);
        if (documentDao.restoreDocument(documentId, memberId, DocumentScope.PRACTICE.name()) == 0) {
            throw new DocumentNotFoundException();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentHistoryResponse> getDocumentHistories(Long documentId) {
        // 문서가 없거나 다른 범위면 404. 반환값은 쓰지 않고 "존재 확인"만 한다.
        getRequiredDocumentIncludingDeleted(documentId, DocumentScope.PRACTICE);
        return documentDao.selectDocumentHistories(documentId);
    }

    /** 사용 중(use_yn = 'Y')인 문서를 찾는다. 없거나 삭제됐으면 404. */
    private DocumentDetailRow getRequiredDocument(Long documentId, DocumentScope documentScope) {
        DocumentDetailRow document = getRequiredDocumentIncludingDeleted(documentId, documentScope);
        if (!"Y".equals(document.getUseYn())) {
            throw new DocumentNotFoundException();
        }
        return document;
    }

    /**
     * 삭제 여부와 관계없이 문서를 찾는다.
     * 범위가 다르면(예: 연습장 API로 HISTORY 글 요청) 존재하지 않는 것처럼 404로 답한다.
     */
    private DocumentDetailRow getRequiredDocumentIncludingDeleted(Long documentId, DocumentScope documentScope) {
        DocumentDetailRow document = documentDao.selectDocumentById(documentId);
        if (document == null || !documentScope.name().equals(document.getDocumentScope())) {
            throw new DocumentNotFoundException();
        }
        return document;
    }

    /** 작성자 본인이 아니면 403. Long끼리는 ==가 아니라 equals로 비교해야 한다(==는 같은 객체인지 비교). */
    private void validateOwner(DocumentDetailRow document, Long memberId) {
        if (!document.getAuthorId().equals(memberId)) {
            throw new DocumentEditForbiddenException();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentTagCountResponse> getPopularTags(DocumentScope documentScope, Long authorId, DocumentStatus documentStatus) {
        return documentDao.selectPopularTags(documentScope.name(), authorId, documentStatus == null ? null : documentStatus.name());
    }

    /**
     * "#React", " react ", "Spring Boot" → ["React", "Spring Boot"]
     * 앞뒤 공백과 맨 앞 #을 지우고, 대소문자만 다른 중복은 처음 것만 남긴다.
     * (DB 정렬 규칙도 대소문자를 구분하지 않으므로 여기서 걸러야 기본 키 중복 오류가 나지 않는다)
     */
    private List<String> normalizeTags(List<String> rawTags) {
        Map<String, String> uniqueTags = new LinkedHashMap<>();
        for (String rawTag : rawTags) {
            String tag = rawTag == null ? "" : rawTag.trim().replaceFirst("^#+", "").trim();
            if (tag.isEmpty()) continue;
            if (tag.length() > 20) {
                throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "태그는 20자 이하여야 합니다: " + tag);
            }
            uniqueTags.putIfAbsent(tag.toLowerCase(Locale.ROOT), tag);
        }
        return List.copyOf(uniqueTags.values());
    }

    /**
     * DB 행(DocumentDetailRow) → API 응답(DocumentDetailResponse)으로 바꾼다.
     * contentJson은 DB에서 문자열로 읽히므로 readTree로 JSON 객체로 바꿔, 응답에서 문자열이 아닌 객체로 내보낸다.
     * 첨부파일과 태그는 별도 테이블이라 따로 조회해 합친다.
     */
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
                documentDao.selectTagsByDocumentIds(List.of(row.getDocumentId())).stream().map(DocumentTagRow::getTagName).toList(),
                row.getDocumentStatus(),
                row.getVersionNumber(),
                row.getViewCount(),
                row.getCreatedAt(),
                row.getUpdatedAt()
            );
        // DB에 깨진 JSON이 있다는 것은 데이터 문제(버그)이므로 사용자 입력 오류(400)가 아니라 500으로 처리되게 한다.
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DB에 저장된 contentJson을 읽을 수 없습니다.", exception);
        }
    }

    /** 에디터 본문(JsonNode)을 DB에 넣을 JSON 문자열로 바꾼다. SQL에서 CAST(... AS JSON)으로 다시 JSON 타입이 된다. */
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

    /** 첨부파일 개수 제한(20개)과 각 파일의 소유자·상태를 확인한다. */
    private void validateAttachmentFiles(List<Long> attachmentFileIds, Long memberId) {
        if (attachmentFileIds.size() > MAXIMUM_ATTACHMENT_COUNT) {
            throw new BusinessException(
                ErrorCode.COMMON_INVALID_REQUEST,
                "첨부파일은 최대 " + MAXIMUM_ATTACHMENT_COUNT + "개까지 등록할 수 있습니다."
            );
        }
        attachmentFileIds.forEach(fileId -> getUsableOwnedFile(fileId, memberId));
    }

    /**
     * 파일이 존재하고(삭제되지 않았고) 내가 올린 것인지 확인한다.
     * 남이 올린 파일 번호를 적어 내 문서에 붙이는 것을 막는다.
     */
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

    /** LinkedHashSet으로 순서는 지키면서 중복 번호를 없애고, null·0 이하 번호를 거른다. */
    private List<Long> normalizeAttachmentFileIds(List<Long> attachmentFileIds) {
        return new LinkedHashSet<>(attachmentFileIds).stream()
            .filter(fileId -> fileId != null && fileId > 0)
            .toList();
    }

    /**
     * 문서의 첨부 목록을 요청과 똑같이 맞춘다: 기존 연결을 모두 지우고 요청 순서대로 다시 넣는다.
     * 배열 위치(attachmentIndex)를 sort_order로 저장해 화면에 올린 순서대로 보이게 한다.
     */
    private void synchronizeDocumentAttachments(Long documentId, List<Long> attachmentFileIds, Long memberId) {
        documentDao.deleteDocumentAttachments(documentId);
        for (int attachmentIndex = 0; attachmentIndex < attachmentFileIds.size(); attachmentIndex++) {
            Long fileId = attachmentFileIds.get(attachmentIndex);
            documentDao.insertDocumentAttachment(documentId, fileId, attachmentIndex);
            activateFileWhenPresent(fileId, memberId);
        }
    }

    /**
     * 업로드 직후 파일은 TEMP 상태다(아직 어느 문서에도 붙지 않음).
     * 문서에 연결되는 순간 ACTIVE로 바꿔, 일정 시간이 지난 TEMP 파일을 지우는 정리 작업에서 빠지게 한다.
     */
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

    /**
     * 검색 조건을 "허용 목록"과 비교해 모르는 값은 기본값으로 바꾼다.
     * Mapper XML은 이 값으로 <choose>를 골라 ORDER BY 컬럼을 정하므로, 정해진 값만 들어가야 예측한 SQL이 나온다.
     */
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
