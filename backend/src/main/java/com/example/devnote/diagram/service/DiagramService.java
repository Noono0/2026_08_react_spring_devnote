package com.example.devnote.diagram.service;

import com.example.devnote.diagram.dto.*;
import com.example.devnote.document.dto.PageResponse;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

public interface DiagramService {
    PageResponse<DiagramListItemResponse> getDiagrams(DiagramSearchCondition condition, HttpServletRequest request);

    DiagramDetailResponse getDiagram(Long diagramId, HttpServletRequest request);

    DiagramDetailResponse create(DiagramSaveRequest saveRequest, HttpServletRequest request);

    DiagramDetailResponse update(Long diagramId, DiagramSaveRequest saveRequest, HttpServletRequest request);

    void delete(Long diagramId, HttpServletRequest request);

    List<DiagramVersionResponse> getVersions(Long diagramId, HttpServletRequest request);

    DiagramVersionResponse getVersion(Long diagramId, Long versionNumber, HttpServletRequest request);

    /** 이전 버전 내용을 현재 다이어그램에 되돌린다. 되돌리기 자체도 새 버전으로 남는다. */
    DiagramDetailResponse restoreVersion(Long diagramId, Long versionNumber, HttpServletRequest request);
}
