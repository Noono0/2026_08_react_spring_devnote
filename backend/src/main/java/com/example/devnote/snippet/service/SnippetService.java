package com.example.devnote.snippet.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.snippet.dao.SnippetDao;
import com.example.devnote.snippet.dao.parameter.SnippetSaveParameter;
import com.example.devnote.snippet.dao.row.SnippetRow;
import com.example.devnote.snippet.dto.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SnippetService {
    private final SnippetDao snippetDao;
    private final AuthenticationService authenticationService;
    private final ObjectMapper objectMapper;

    public PageResponse<SnippetResponse> getSnippets(SnippetSearchCondition condition, HttpServletRequest request) {
        MemberRow member = requireMember(request);
        condition.setMemberId(member.getMemberId());
        List<SnippetResponse> content = snippetDao.selectSnippets(condition).stream().map(this::toResponse).toList();
        return PageResponse.of(content, condition.getPageNumber(), condition.getPageSize(), snippetDao.countSnippets(condition));
    }

    public SnippetResponse getSnippet(Long snippetId, HttpServletRequest request) {
        return toResponse(requireSnippet(snippetId, requireMember(request).getMemberId()));
    }

    @Transactional
    public SnippetResponse create(SnippetSaveRequest saveRequest, HttpServletRequest request) {
        MemberRow member = requireMember(request);
        SnippetSaveParameter parameter = toParameter(null, member.getMemberId(), saveRequest);
        snippetDao.insertSnippet(parameter);
        return toResponse(requireSnippet(parameter.getDeveloperSnippetId(), member.getMemberId()));
    }

    @Transactional
    public SnippetResponse update(Long snippetId, SnippetSaveRequest saveRequest, HttpServletRequest request) {
        MemberRow member = requireMember(request);
        SnippetRow current = requireSnippet(snippetId, member.getMemberId());
        if (!"Y".equals(current.getUseYn())) throw new BusinessException(ErrorCode.SNIPPET_NOT_FOUND);
        SnippetSaveParameter parameter = toParameter(snippetId, member.getMemberId(), saveRequest);
        if (snippetDao.updateSnippet(parameter) == 0) throw new BusinessException(ErrorCode.SNIPPET_NOT_FOUND);
        return toResponse(requireSnippet(snippetId, member.getMemberId()));
    }

    @Transactional
    public void delete(Long snippetId, HttpServletRequest request) {
        Long memberId = requireMember(request).getMemberId();
        if (snippetDao.softDeleteSnippet(snippetId, memberId) == 0) throw new BusinessException(ErrorCode.SNIPPET_NOT_FOUND);
    }

    @Transactional
    public SnippetResponse restore(Long snippetId, HttpServletRequest request) {
        Long memberId = requireMember(request).getMemberId();
        if (snippetDao.restoreSnippet(snippetId, memberId) == 0) throw new BusinessException(ErrorCode.SNIPPET_NOT_FOUND);
        return toResponse(requireSnippet(snippetId, memberId));
    }

    @Transactional
    public int bulkDelete(SnippetBulkRequest bulkRequest, HttpServletRequest request) {
        return snippetDao.softDeleteSnippets(bulkRequest.snippetIds().stream().distinct().toList(), requireMember(request).getMemberId());
    }

    @Transactional
    public int bulkRestore(SnippetBulkRequest bulkRequest, HttpServletRequest request) {
        return snippetDao.restoreSnippets(bulkRequest.snippetIds().stream().distinct().toList(), requireMember(request).getMemberId());
    }

    private SnippetSaveParameter toParameter(Long snippetId, Long memberId, SnippetSaveRequest request) {
        List<String> tags = request.tags().stream().map(String::trim).filter(tag -> !tag.isBlank()).distinct().toList();
        try {
            return SnippetSaveParameter.builder()
                .developerSnippetId(snippetId).memberId(memberId).snippetTitle(request.title().trim())
                .snippetDescription(request.description().trim()).snippetLanguage(request.language().trim())
                .snippetCode(request.code()).tagsJson(objectMapper.writeValueAsString(tags))
                .favoriteYn(request.favorite() ? "Y" : "N").build();
        } catch (JsonProcessingException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "태그를 저장 가능한 형태로 변환하지 못했습니다.");
        }
    }

    private SnippetRow requireSnippet(Long snippetId, Long memberId) {
        SnippetRow snippet = snippetDao.selectSnippet(snippetId, memberId);
        if (snippet == null) throw new BusinessException(ErrorCode.SNIPPET_NOT_FOUND);
        return snippet;
    }

    private MemberRow requireMember(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        if (member == null) throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        return member;
    }

    private SnippetResponse toResponse(SnippetRow row) {
        try {
            return new SnippetResponse(
                row.getDeveloperSnippetId(), row.getSnippetTitle(), row.getSnippetDescription(),
                row.getSnippetLanguage(), row.getSnippetCode(), objectMapper.readValue(row.getTagsJson(), new TypeReference<>() {}),
                "Y".equals(row.getFavoriteYn()), "N".equals(row.getUseYn()),
                toInstant(row.getCreatedAt()), toInstant(row.getUpdatedAt()), toInstant(row.getDeletedAt())
            );
        } catch (JsonProcessingException exception) {
            throw new BusinessException(ErrorCode.COMMON_INTERNAL_SERVER_ERROR, "저장된 코드 조각 태그를 읽지 못했습니다.");
        }
    }

    private Instant toInstant(java.time.LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}

