package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.parameter.MemberCreateParameter;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

/**
 * 로그인·회원가입·로그아웃과 "현재 로그인한 회원 찾기"를 담당합니다.
 *
 * [세션 로그인 방식]
 *   1. 로그인에 성공하면 서버 메모리의 HttpSession에 회원 번호를 적어 둔다(AUTHENTICATED_MEMBER_ID).
 *   2. 브라우저에는 세션을 찾는 열쇠(세션 ID)만 쿠키로 준다. 회원 정보 자체는 쿠키에 넣지 않는다.
 *   3. 다음 요청부터 브라우저가 쿠키를 자동으로 보내면, 서버는 세션에서 회원 번호를 꺼낸다(findAuthenticatedMember).
 *   ★ 서버를 재시작하면 메모리의 세션이 사라져 모두 로그아웃된다(학습용으로 단순하게 둔 부분).
 *
 * @Transactional(readOnly = true): 클래스 기본은 읽기 전용. DB를 바꾸는 메서드(login·register)만 @Transactional로 다시 연다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthenticationService {
    /** 세션에 회원 번호를 저장할 때 쓰는 이름(키). 다른 클래스에서 같은 이름을 쓰도록 상수로 공개한다. */
    public static final String AUTHENTICATED_MEMBER_ID = "AUTHENTICATED_MEMBER_ID";
    private final MemberDao memberDao;
    private final MemberPasswordService passwordService;
    // @Value("${이름:기본값}"): application.yml 값을 읽고, 없으면 : 뒤의 기본값을 쓴다. "30d"는 Duration(30일)으로 자동 변환된다.
    @Value("${auth.remember-me-duration:30d}")
    private Duration rememberMeDuration;
    @Value("${server.servlet.session.cookie.name:JSESSIONID}")
    private String sessionCookieName;
    @Value("${server.servlet.session.cookie.secure:false}")
    private boolean sessionCookieSecure;

    @Transactional
    public AuthSessionResponse login(LoginRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        // 앞뒤 공백을 지운 아이디로 회원을 찾는다.
        MemberRow member = memberDao.selectMemberByLoginId(request.loginId().trim());
        // ★ "아이디가 없음"과 "비밀번호가 틀림"을 같은 오류(LOGIN_FAILED)로 돌려준다.
        //   따로 알려 주면 공격자가 "어떤 아이디가 가입돼 있는지"를 알아낼 수 있기 때문이다.
        if (member == null || !passwordService.matches(request.password(), member.getPasswordHash())) {
            throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }
        // 정지·휴면 등 ACTIVE가 아닌 계정은 비밀번호가 맞아도 로그인할 수 없다.
        if (!"ACTIVE".equals(member.getAccountStatus())) {
            throw new BusinessException(ErrorCode.ACCOUNT_NOT_ACTIVE);
        }
        // getSession(true): 세션이 없으면 새로 만든다.
        HttpSession session = servletRequest.getSession(true);
        // ★ 로그인 순간 세션 ID를 새로 바꾼다(세션 고정 공격 방지).
        //   공격자가 미리 알려 준 세션 ID로 로그인하게 만들어도, 로그인 후에는 다른 ID가 되어 그 ID로는 접근할 수 없다.
        servletRequest.changeSessionId();
        session.setAttribute(AUTHENTICATED_MEMBER_ID, member.getMemberId());
        configureSessionCookie(session, request.autoLogin(), servletResponse);
        memberDao.updateLastLoginAt(member.getMemberId());
        // 방금 갱신한 마지막 로그인 시각까지 반영된 최신 정보를 다시 읽어 응답한다.
        return toSession(memberDao.selectMemberById(member.getMemberId()));
    }

    @Transactional
    public AuthSessionResponse register(RegisterRequest request, HttpServletRequest servletRequest) {
        String loginId = request.loginId().trim();
        if (memberDao.selectMemberByLoginId(loginId) != null) {
            throw new BusinessException(ErrorCode.LOGIN_ID_ALREADY_EXISTS);
        }
        // 이메일은 대소문자를 구분하지 않으므로 소문자로 맞춰 저장한다(A@b.com과 a@B.com을 같은 이메일로 본다).
        String normalizedEmail = request.email().trim().toLowerCase();
        if (memberDao.selectMemberByEmail(normalizedEmail) != null) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        // 비밀번호는 해시로 바꿔 저장하고, 역할·등급은 사용자가 고르지 못하게 서버가 정한다(USER, BRONZE).
        MemberCreateParameter parameter = MemberCreateParameter.builder()
            .loginId(loginId)
            .passwordHash(passwordService.encode(request.password()))
            .email(normalizedEmail)
            .memberName(request.memberName().trim())
            .memberRole(MemberRole.USER.name())
            .gradeCode(MemberGrade.BRONZE.name())
            .build();
        try {
            memberDao.insertMember(parameter);
        // 위의 중복 검사와 INSERT 사이에 다른 요청이 같은 아이디로 먼저 가입할 수 있다(동시 요청).
        // 그때는 DB의 UNIQUE 제약이 막아 DuplicateKeyException이 나므로, 어느 값이 겹쳤는지 다시 확인해 알맞은 오류로 바꾼다.
        } catch (DuplicateKeyException exception) {
            if (memberDao.selectMemberByLoginId(loginId) != null) {
                throw new BusinessException(ErrorCode.LOGIN_ID_ALREADY_EXISTS);
            }
            if (memberDao.selectMemberByEmail(normalizedEmail) != null) {
                throw new BusinessException(ErrorCode.EMAIL_ALREADY_EXISTS);
            }
            // 아이디·이메일이 아닌 다른 이유의 중복이면 숨기지 않고 그대로 던진다(500으로 기록되어 원인을 찾을 수 있다).
            throw exception;
        }
        // 가입 직후 바로 로그인 상태로 만든다(로그인 화면을 한 번 더 거치지 않게).
        HttpSession session = servletRequest.getSession(true);
        servletRequest.changeSessionId();
        session.setAttribute(AUTHENTICATED_MEMBER_ID, parameter.getMemberId());
        return toSession(memberDao.selectMemberById(parameter.getMemberId()));
    }

    /** 현재 로그인 상태를 돌려준다. 로그인하지 않았으면 오류 대신 guest를 준다. */
    public AuthSessionResponse getSession(HttpServletRequest request) {
        MemberRow member = findAuthenticatedMember(request);
        return member == null ? AuthSessionResponse.guest() : toSession(member);
    }

    /**
     * 세션에 저장된 회원 번호로 회원을 찾는다. 다른 Service(관리자·포트폴리오 등)도 이 메서드로 로그인 회원을 확인한다.
     * getSession(false): 세션이 없으면 새로 만들지 않고 null을 돌려준다(조회만 하는데 빈 세션을 만들 필요가 없다).
     * 로그인 뒤에 계정이 정지됐을 수 있으므로 매번 DB에서 상태(ACTIVE)를 다시 확인한다.
     */
    public MemberRow findAuthenticatedMember(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return null;
        Object memberId = session.getAttribute(AUTHENTICATED_MEMBER_ID);
        // 세션 값은 Object로 저장되므로 Long인지 확인하고 꺼낸다(패턴 매칭).
        if (!(memberId instanceof Long authenticatedMemberId)) return null;
        MemberRow member = memberDao.selectMemberById(authenticatedMemberId);
        return member != null && "ACTIVE".equals(member.getAccountStatus()) ? member : null;
    }

    /** 서버의 세션을 없애고(invalidate), 브라우저 쿠키도 만료 시간 0으로 덮어써 즉시 지우게 한다. */
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        response.addHeader(HttpHeaders.SET_COOKIE, buildSessionCookie("", Duration.ZERO).toString());
    }

    /**
     * 자동 로그인 여부에 따라 세션 쿠키를 다시 내려준다.
     *   자동 로그인 O: 서버 세션 유효 시간과 쿠키 만료일을 모두 rememberMeDuration(기본 30일)으로 늘린다.
     *   자동 로그인 X: maxAge -1 = "브라우저를 닫으면 사라지는 쿠키".
     */
    private void configureSessionCookie(HttpSession session, boolean autoLogin, HttpServletResponse response) {
        if (autoLogin) session.setMaxInactiveInterval(Math.toIntExact(rememberMeDuration.toSeconds()));
        Duration maxAge = autoLogin ? rememberMeDuration : Duration.ofSeconds(-1);
        response.addHeader(HttpHeaders.SET_COOKIE, buildSessionCookie(session.getId(), maxAge).toString());
    }

    /**
     * 세션 쿠키의 보안 옵션.
     *   httpOnly : JavaScript(document.cookie)로 읽을 수 없다 → XSS로 쿠키를 훔치기 어렵다.
     *   secure   : HTTPS에서만 보낸다(운영에서 SESSION_COOKIE_SECURE=true).
     *   sameSite Strict: 다른 사이트에서 시작한 요청에는 쿠키를 붙이지 않는다 → CSRF 방어.
     */
    private ResponseCookie buildSessionCookie(String value, Duration maxAge) {
        return ResponseCookie.from(sessionCookieName, value)
            .httpOnly(true)
            .secure(sessionCookieSecure)
            .sameSite("Strict")
            .path("/")
            .maxAge(maxAge)
            .build();
    }

    /** DB 행(MemberRow)을 응답용 객체로 바꾼다. 문자열로 저장된 역할·등급을 enum으로 바꾸고, 비밀번호 해시는 뺀다. */
    private AuthSessionResponse toSession(MemberRow member) {
        MemberRole role = MemberRole.valueOf(member.getMemberRole());
        return new AuthSessionResponse(true, member.getMemberId(), member.getLoginId(), member.getMemberName(), member.getEmail(),
            MemberGrade.valueOf(member.getGradeCode()), role, role.isAdministrator(), role == MemberRole.SUPER_ADMIN);
    }
}
