package com.example.devnote.portfolio.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 포트폴리오 편집 권한을 확인합니다.
 *
 *   isUnlocked   : 로그인한 슈퍼관리자인가? → 숨긴 섹션까지 볼 수 있는지 판단
 *   requireEditor: 슈퍼관리자이면서, 요청에 X-Portfolio-Editor: true 헤더가 있는가? → 변경 요청 허용
 *
 * 헤더를 한 번 더 요구하는 이유: 편집기 코드(portfolioApi.ts)가 보낸 요청임을 표시해,
 * 다른 화면이나 단순 링크·폼 전송으로 편집 API가 실수로 불리는 것을 막는다.
 * (다른 사이트의 JavaScript가 직접 만든 헤더를 붙이면 CORS 사전 확인에서 막힌다)
 */
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
