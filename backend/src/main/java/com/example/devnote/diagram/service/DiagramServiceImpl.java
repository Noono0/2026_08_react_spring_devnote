package com.example.devnote.diagram.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.diagram.dao.DiagramDao;
import com.example.devnote.diagram.dao.parameter.DiagramCreateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramUpdateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramVersionCreateParameter;
import com.example.devnote.diagram.dao.row.DiagramRow;
import com.example.devnote.diagram.dao.row.DiagramVersionRow;
import com.example.devnote.diagram.dto.DiagramDetailResponse;
import com.example.devnote.diagram.dto.DiagramListItemResponse;
import com.example.devnote.diagram.dto.DiagramSaveRequest;
import com.example.devnote.diagram.dto.DiagramSearchCondition;
import com.example.devnote.diagram.dto.DiagramType;
import com.example.devnote.diagram.dto.DiagramVersionResponse;
import com.example.devnote.diagram.exception.DiagramModelInvalidException;
import com.example.devnote.diagram.exception.DiagramNotFoundException;
import com.example.devnote.diagram.exception.DiagramVersionConflictException;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.member.service.CurrentMemberProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DiagramServiceImpl implements DiagramService {
    /**
     * 다이어그램 하나가 보관하는 최대 이력 수.
     *
     * 무제한으로 쌓으면 저사양(무료티어) DB의 저장 공간을 빠르게 소모한다.
     * 모델 JSON 하나가 수십 KB일 수 있어 100번만 저장해도 수 MB가 된다.
     * 최근 30개만 남기고 오래된 것부터 정리한다.
     */
    private static final int MAX_KEPT_VERSIONS = 30;

    private final DiagramDao diagramDao;
    private final CurrentMemberProvider currentMemberProvider;
    private final ObjectMapper objectMapper;

    @Override
    public PageResponse<DiagramListItemResponse> getDiagrams(DiagramSearchCondition condition, HttpServletRequest request) {
        Long memberId = currentMemberProvider.getCurrentMemberId(request);
        List<DiagramListItemResponse> content = diagramDao.selectDiagrams(memberId, condition).stream()
            .map(this::toListItemResponse)
            .toList();
        long totalElements = diagramDao.countDiagrams(memberId, condition);
        return PageResponse.of(content, condition.resolvedPageNumber(), condition.resolvedPageSize(), totalElements);
    }

    @Override
    public DiagramDetailResponse getDiagram(Long diagramId, HttpServletRequest request) {
        return toDetailResponse(findOwnedDiagram(diagramId, request));
    }

    @Override
    @Transactional
    public DiagramDetailResponse create(DiagramSaveRequest saveRequest, HttpServletRequest request) {
        Long memberId = currentMemberProvider.getCurrentMemberId(request);
        validateDiagramModel(saveRequest.diagramModelJson());

        DiagramCreateParameter parameter = DiagramCreateParameter.builder()
            .memberId(memberId)
            .diagramTitle(saveRequest.diagramTitle().trim())
            .diagramDescription(saveRequest.diagramDescription().trim())
            .diagramType(saveRequest.diagramType().name())
            .diagramModel(saveRequest.diagramModelJson())
            .build();
        diagramDao.insertDiagram(parameter);

        // 최초 저장도 1번 버전으로 남겨 두면 나중에 "처음 상태"로 되돌릴 수 있다.
        insertVersion(parameter.getDiagramId(), 1L, saveRequest.diagramTitle().trim(),
            saveRequest.diagramType().name(), saveRequest.diagramModelJson(),
            saveRequest.changeSummary(), memberId);

        log.info("다이어그램 생성 diagramId={} memberId={} type={}",
            parameter.getDiagramId(), memberId, saveRequest.diagramType());
        return getDiagram(parameter.getDiagramId(), request);
    }

    @Override
    @Transactional
    public DiagramDetailResponse update(Long diagramId, DiagramSaveRequest saveRequest, HttpServletRequest request) {
        Long memberId = currentMemberProvider.getCurrentMemberId(request);
        DiagramRow current = findOwnedDiagram(diagramId, request);
        validateDiagramModel(saveRequest.diagramModelJson());

        // 클라이언트가 버전을 보내지 않았다면 현재 버전을 기대값으로 삼는다(단독 편집으로 간주).
        long expectedVersion = saveRequest.versionNumber() == null
            ? current.getVersionNumber()
            : saveRequest.versionNumber();

        int updatedCount = diagramDao.updateDiagram(DiagramUpdateParameter.builder()
            .diagramId(diagramId)
            .memberId(memberId)
            .diagramTitle(saveRequest.diagramTitle().trim())
            .diagramDescription(saveRequest.diagramDescription().trim())
            .diagramType(saveRequest.diagramType().name())
            .diagramModel(saveRequest.diagramModelJson())
            .expectedVersionNumber(expectedVersion)
            .build());

        // WHERE 절의 version_number 가 안 맞으면 0건이 갱신된다 = 그 사이 누가 먼저 저장했다.
        if (updatedCount == 0) {
            log.warn("다이어그램 버전 충돌 diagramId={} memberId={} expectedVersion={}",
                diagramId, memberId, expectedVersion);
            throw new DiagramVersionConflictException();
        }

        long nextVersion = expectedVersion + 1;

        // 내용이 실제로 바뀐 경우에만 이력을 남긴다.
        // 노드를 조금 옮기고 저장을 반복해도 이력이 무한정 쌓이지 않게 하기 위함이다.
        boolean modelChanged = !saveRequest.diagramModelJson().equals(current.getDiagramModel());
        boolean titleChanged = !saveRequest.diagramTitle().trim().equals(current.getDiagramTitle());
        if (modelChanged || titleChanged) {
            insertVersion(diagramId, nextVersion, saveRequest.diagramTitle().trim(),
                saveRequest.diagramType().name(), saveRequest.diagramModelJson(),
                saveRequest.changeSummary(), memberId);
            int removedCount = diagramDao.deleteOldDiagramVersions(diagramId, MAX_KEPT_VERSIONS);
            if (removedCount > 0) {
                log.info("다이어그램 오래된 이력 정리 diagramId={} removed={}", diagramId, removedCount);
            }
        }

        log.info("다이어그램 저장 diagramId={} memberId={} version={} modelChanged={}",
            diagramId, memberId, nextVersion, modelChanged);
        return getDiagram(diagramId, request);
    }

    @Override
    @Transactional
    public void delete(Long diagramId, HttpServletRequest request) {
        Long memberId = currentMemberProvider.getCurrentMemberId(request);
        // soft delete. 이력과 함께 남겨 두어 실수로 지웠을 때 복구할 여지를 둔다.
        int deletedCount = diagramDao.softDeleteDiagram(diagramId, memberId);
        if (deletedCount == 0) {
            throw new DiagramNotFoundException();
        }
        log.info("다이어그램 삭제 diagramId={} memberId={}", diagramId, memberId);
    }

    @Override
    public List<DiagramVersionResponse> getVersions(Long diagramId, HttpServletRequest request) {
        findOwnedDiagram(diagramId, request); // 소유권 확인이 목적
        return diagramDao.selectDiagramVersions(diagramId).stream()
            .map(row -> toVersionResponse(row, false))
            .toList();
    }

    @Override
    public DiagramVersionResponse getVersion(Long diagramId, Long versionNumber, HttpServletRequest request) {
        findOwnedDiagram(diagramId, request);
        DiagramVersionRow row = diagramDao.selectDiagramVersion(diagramId, versionNumber);
        if (row == null) {
            throw new BusinessException(ErrorCode.DIAGRAM_VERSION_NOT_FOUND);
        }
        return toVersionResponse(row, true);
    }

    @Override
    @Transactional
    public DiagramDetailResponse restoreVersion(Long diagramId, Long versionNumber, HttpServletRequest request) {
        DiagramRow current = findOwnedDiagram(diagramId, request);
        DiagramVersionRow target = diagramDao.selectDiagramVersion(diagramId, versionNumber);
        if (target == null) {
            throw new BusinessException(ErrorCode.DIAGRAM_VERSION_NOT_FOUND);
        }

        // 되돌리기를 "과거 내용으로 새로 저장"으로 처리한다.
        // 이력을 지우지 않으므로 되돌린 뒤에도 되돌리기 직전 상태로 다시 갈 수 있다.
        DiagramSaveRequest restoreRequest = new DiagramSaveRequest(
            target.getDiagramTitle(),
            current.getDiagramDescription(),
            DiagramType.valueOf(target.getDiagramType()),
            target.getDiagramModel(),
            versionNumber + "번 버전으로 되돌림",
            current.getVersionNumber()
        );
        log.info("다이어그램 버전 복원 diagramId={} restoredFrom={}", diagramId, versionNumber);
        return update(diagramId, restoreRequest, request);
    }

    /** 소유자 본인의 다이어그램만 반환한다. 없거나 남의 것이면 404로 처리한다. */
    private DiagramRow findOwnedDiagram(Long diagramId, HttpServletRequest request) {
        Long memberId = currentMemberProvider.getCurrentMemberId(request);
        DiagramRow row = diagramDao.selectDiagram(diagramId, memberId);
        if (row == null) {
            // 남의 다이어그램일 때 403이 아니라 404를 주는 이유:
            // 403은 "그 id의 다이어그램이 존재한다"는 사실을 알려 주는 셈이라
            // id를 훑어 남의 데이터 존재 여부를 알아내는 데 쓰일 수 있다.
            throw new DiagramNotFoundException();
        }
        return row;
    }

    /**
     * 모델이 유효한 JSON 인지만 확인한다.
     *
     * 노드/엣지의 세부 구조는 편집기(프론트엔드)의 책임으로 두어
     * 편집기 모델이 바뀔 때마다 서버를 고치지 않아도 되게 했다.
     * 다만 검증 없이 저장하면 깨진 문자열이 DB에 들어가 조회 자체가 실패할 수 있으므로
     * "파싱 가능한 JSON 인가"라는 최소 조건은 서버에서 지킨다.
     */
    private void validateDiagramModel(String diagramModelJson) {
        try {
            objectMapper.readTree(diagramModelJson);
        } catch (Exception parseFailure) {
            throw new DiagramModelInvalidException();
        }
    }

    private void insertVersion(Long diagramId, Long versionNumber, String diagramTitle, String diagramType,
                               String diagramModel, String changeSummary, Long memberId) {
        diagramDao.insertDiagramVersion(DiagramVersionCreateParameter.builder()
            .diagramId(diagramId)
            .versionNumber(versionNumber)
            .diagramTitle(diagramTitle)
            .diagramType(diagramType)
            .diagramModel(diagramModel)
            .changeSummary(changeSummary)
            .changedBy(memberId)
            .build());
    }

    private Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }

    private DiagramListItemResponse toListItemResponse(DiagramRow row) {
        return new DiagramListItemResponse(
            row.getDiagramId(), row.getDiagramTitle(), row.getDiagramDescription(),
            DiagramType.valueOf(row.getDiagramType()), row.getVersionNumber(),
            toInstant(row.getCreatedAt()), toInstant(row.getUpdatedAt()));
    }

    private DiagramDetailResponse toDetailResponse(DiagramRow row) {
        return new DiagramDetailResponse(
            row.getDiagramId(), row.getDiagramTitle(), row.getDiagramDescription(),
            DiagramType.valueOf(row.getDiagramType()), row.getDiagramModel(), row.getVersionNumber(),
            toInstant(row.getCreatedAt()), toInstant(row.getUpdatedAt()));
    }

    /**
     * 버전 목록에서는 모델 JSON을 빼고 내려보낸다.
     * 버전이 30개면 모델도 30개가 실려 응답이 수 MB가 될 수 있기 때문이다.
     */
    private DiagramVersionResponse toVersionResponse(DiagramVersionRow row, boolean includeModel) {
        return new DiagramVersionResponse(
            row.getDiagramVersionId(), row.getDiagramId(), row.getVersionNumber(),
            row.getDiagramTitle(), DiagramType.valueOf(row.getDiagramType()),
            includeModel ? row.getDiagramModel() : null,
            row.getChangeSummary(), toInstant(row.getCreatedAt()));
    }
}
