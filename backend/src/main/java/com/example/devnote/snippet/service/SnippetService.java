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

/**
 * 개인 코드 조각 보관함의 업무 규칙입니다.
 * 모든 메서드가 requireMember로 로그인 회원을 먼저 확인하고, 그 회원 번호로만 조회·변경한다.
 * 남의 코드 조각 번호를 넣어도 "없음(404)"으로 답해, 다른 회원의 코드 조각이 있는지조차 알 수 없게 한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SnippetService {
    private final SnippetDao snippetDao;
    private final AuthenticationService authenticationService;
    private final ObjectMapper objectMapper;

    public PageResponse<SnippetResponse> getSnippets(SnippetSearchCondition condition, HttpServletRequest request) {
        MemberRow member = requireMember(request);
        // 검색 조건의 회원 번호를 로그인 회원으로 강제한다.
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
        // 휴지통에 있는 코드 조각은 먼저 복구해야 수정할 수 있다.
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
        // 같은 번호가 여러 번 와도 한 번만 처리한다. 돌려주는 값 = 실제로 바뀐 개수.
        return snippetDao.softDeleteSnippets(bulkRequest.snippetIds().stream().distinct().toList(), requireMember(request).getMemberId());
    }

    @Transactional
    public int bulkRestore(SnippetBulkRequest bulkRequest, HttpServletRequest request) {
        return snippetDao.restoreSnippets(bulkRequest.snippetIds().stream().distinct().toList(), requireMember(request).getMemberId());
    }

    private SnippetSaveParameter toParameter(Long snippetId, Long memberId, SnippetSaveRequest request) {
        // 태그 정리: 앞뒤 공백 제거 → 빈 태그 제외 → 중복 제거(대소문자는 구분).
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
                // deleted = 휴지통에 있는가(use_yn = 'N').
                "Y".equals(row.getFavoriteYn()), "N".equals(row.getUseYn()),
                toInstant(row.getCreatedAt()), toInstant(row.getUpdatedAt()), toInstant(row.getDeletedAt())
            );
        } catch (JsonProcessingException exception) {
            throw new BusinessException(ErrorCode.COMMON_INTERNAL_SERVER_ERROR, "저장된 코드 조각 태그를 읽지 못했습니다.");
        }
    }

    /** DB의 LocalDateTime(UTC로 저장됨) → Instant. 값이 없으면(삭제 시각 등) null. */
    private Instant toInstant(java.time.LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}

