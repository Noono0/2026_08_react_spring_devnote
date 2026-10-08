package com.example.devnote.member.service;

import jakarta.servlet.http.HttpServletRequest;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 인증 기능을 붙이기 전에도 권한과 소유권을 연습할 수 있도록 X-Member-Id 헤더를 사용합니다.
 * 운영 프로젝트에서는 Spring Security Authentication에서 memberId를 읽어야 합니다.
  *
  * [회원 번호를 정하는 순서]
  *   1. 로그인 세션이 있으면 그 회원 번호를 쓴다.
  *   2. 없으면 X-Member-Id 헤더 값을 쓴다(프론트의 "회원 전환" 학습 기능).
  *   3. 헤더도 없으면 개발용 기본 회원 1번으로 본다.
  *
  * ★ 2·3번은 누구나 다른 회원인 척할 수 있는 학습용 장치다. 그래서 운영(compose.app.yml)에서는
  *   AUTH_ALLOW_DEVELOPMENT_MEMBER=false로 끄고, 로그인 세션만 인정한다(없으면 401).
 */
@Component
public class CurrentMemberProvider {
    private static final long DEFAULT_DEVELOPMENT_MEMBER_ID = 1L;

    private final AuthenticationService authenticationService;
    /**
     * true(로컬 기본): 위 2·3번 학습용 대체를 쓴다.
     * false(운영): 로그인 세션만 인정하고 X-Member-Id 헤더는 무시한다.
     *   그렇지 않으면 누구나 헤더 하나로 1번 회원(슈퍼관리자)인 척 글·파일을 쓸 수 있다.
     */
    private final boolean allowDevelopmentMember;

    public CurrentMemberProvider(
        AuthenticationService authenticationService,
        @Value("${auth.allow-development-member:true}") boolean allowDevelopmentMember
    ) {
        this.authenticationService = authenticationService;
        this.allowDevelopmentMember = allowDevelopmentMember;
    }

    /** 요청을 보낸 회원 번호를 정하고, 로그(MDC userId)에도 남긴다. TraceIdFilter가 요청 끝에 MDC를 정리한다. */
    public Long getCurrentMemberId(HttpServletRequest request) {
        MemberRow authenticatedMember = authenticationService.findAuthenticatedMember(request);
        if (authenticatedMember != null) {
            MDC.put("userId", String.valueOf(authenticatedMember.getMemberId()));
            return authenticatedMember.getMemberId();
        }
        // 운영: 헤더·기본 회원 대체를 쓰지 않는다. 화면은 401(AUTHENTICATION_REQUIRED)을 받아 로그인을 안내한다.
        if (!allowDevelopmentMember) {
            throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        }
        String memberIdHeader = request.getHeader("X-Member-Id");
        Long memberId;
        try {
            memberId = memberIdHeader == null || memberIdHeader.isBlank()
                ? DEFAULT_DEVELOPMENT_MEMBER_ID
                : Long.valueOf(memberIdHeader);
        // "abc"처럼 숫자가 아닌 헤더 값이면 500이 아니라 400(잘못된 요청)으로 알려 준다.
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
