package com.example.devnote.crawler.config;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 웹 크롤러 API(/api/v1/utilities/crawler/**)를 슈퍼관리자만 쓸 수 있게 막습니다.
 *
 * [왜 막아야 할까?]
 *   크롤러는 서버(또는 연결된 원격 브라우저)로 남의 웹사이트에 접속한다.
 *   누구나 실행할 수 있으면 우리 서버 이름으로 다른 사이트를 긁는 데 악용되고,
 *   저장된 네이버 로그인 세션까지 남이 쓸 수 있다.
 *
 * [HandlerInterceptor란?]
 *   요청이 Controller 메서드에 도착하기 "직전"에 끼어드는 문지기다.
 *   preHandle이 예외를 던지면 Controller는 실행되지 않고, GlobalExceptionHandler가 401·403 응답으로 바꾼다.
 *
 * [왜 Service마다 검사하지 않고 여기서 한 번에 할까?]
 *   이 프로젝트는 보통 Service 계층에서 권한을 검사한다(AdminService.requireSuperAdministrator 등).
 *   크롤러는 API가 17개가 넘어, 메서드마다 넣으면 새 API를 추가할 때 검사를 빼먹기 쉽다.
 *   "이 경로 아래는 전부 슈퍼관리자 전용"이라는 규칙이라 경로 단위 문지기가 더 안전하다.
 *   등록 위치: CrawlerWebConfiguration
 */
@Component
@RequiredArgsConstructor
public class CrawlerAccessInterceptor implements HandlerInterceptor {
    private final AuthenticationService authenticationService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // CORS 사전 요청(OPTIONS)은 쿠키 없이 오므로 검사하지 않고 통과시킨다. 실제 요청에서 다시 검사한다.
        if (CorsUtils.isPreFlightRequest(request)) {
            return true;
        }
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        // 로그인하지 않았으면 401, 로그인했지만 슈퍼관리자가 아니면 403. 둘을 나눠야 화면이 "로그인하세요"와 "권한 없음"을 구분해 안내한다.
        if (member == null) {
            throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED, "웹 크롤링 도구는 슈퍼관리자로 로그인해야 사용할 수 있습니다.");
        }
        if (!"SUPER_ADMIN".equals(member.getMemberRole())) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "웹 크롤링 도구는 슈퍼관리자만 사용할 수 있습니다.");
        }
        return true;
    }
}
