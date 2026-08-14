package com.example.devnote.member.service;

import jakarta.servlet.http.HttpServletRequest;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

/**
 * 인증 기능을 붙이기 전에도 권한과 소유권을 연습할 수 있도록 X-Member-Id 헤더를 사용합니다.
 * 운영 프로젝트에서는 Spring Security Authentication에서 memberId를 읽어야 합니다.
 */
@Component
public class CurrentMemberProvider {
    private static final long DEFAULT_DEVELOPMENT_MEMBER_ID = 1L;

    private final AuthenticationService authenticationService;

    public CurrentMemberProvider(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    public Long getCurrentMemberId(HttpServletRequest request) {
        MemberRow authenticatedMember = authenticationService.findAuthenticatedMember(request);
        if (authenticatedMember != null) {
            MDC.put("userId", String.valueOf(authenticatedMember.getMemberId()));
            return authenticatedMember.getMemberId();
        }
        String memberIdHeader = request.getHeader("X-Member-Id");
        Long memberId;
        try {
            memberId = memberIdHeader == null || memberIdHeader.isBlank()
                ? DEFAULT_DEVELOPMENT_MEMBER_ID
                : Long.valueOf(memberIdHeader);
        } catch (NumberFormatException exception) {
            throw new BusinessException(
                ErrorCode.COMMON_INVALID_REQUEST,
                "X-Member-Id 헤더는 숫자여야 합니다."
            );
        }
        MDC.put("userId", String.valueOf(memberId));
        return memberId;
    }
}
