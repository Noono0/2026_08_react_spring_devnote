package com.example.devnote.portfolio.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PortfolioEditSessionService {
    private static final String EDIT_REQUEST_HEADER = "X-Portfolio-Editor";

    private final AuthenticationService authenticationService;

    public boolean isUnlocked(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        return member != null && "SUPER_ADMIN".equals(member.getMemberRole());
    }

    public void requireEditor(HttpServletRequest request) {
        if (!isUnlocked(request)) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "슈퍼관리자만 포트폴리오를 편집할 수 있습니다.");
        }
        if (!"true".equalsIgnoreCase(request.getHeader(EDIT_REQUEST_HEADER))) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "편집 요청 헤더가 필요합니다.");
        }
    }
}
