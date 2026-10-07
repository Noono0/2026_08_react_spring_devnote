package com.example.devnote.admin.service;

import com.example.devnote.admin.dao.AdminDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 방문 기록을 남깁니다. 같은 브라우저를 구분하기 위해 세션에 무작위 방문자 키(VISITOR_KEY)를 저장한다.
 * 이 키는 개인 정보를 담지 않는 임의의 값이며, 세션이 끝나면 다음 방문은 새 방문자로 센다.
 */
@Service
@RequiredArgsConstructor
public class VisitorTrackingService {
    private static final String VISITOR_KEY = "VISITOR_KEY";
    private final AdminDao adminDao;
    private final AuthenticationService authenticationService;

    @Transactional
    public void record(String path, HttpServletRequest request) {
        String visitorKey = resolveVisitorKey(request);
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        // 경로는 DB 컬럼 길이(500)에 맞춰 자른다. 너무 긴 값이 와도 저장 오류가 나지 않게 한다.
        adminDao.insertVisitorEvent(visitorKey, member == null ? null : member.getMemberId(), path.length() > 500 ? path.substring(0, 500) : path);
    }

    /** 세션에 방문자 키가 있으면 그대로, 없으면 새로 만들어 저장하고 돌려준다(토픽 투표의 중복 투표 확인에도 쓴다). */
    public String resolveVisitorKey(HttpServletRequest request) {
        HttpSession session = request.getSession(true);
        String visitorKey = (String) session.getAttribute(VISITOR_KEY);
        if (visitorKey != null) return visitorKey;

        String createdVisitorKey = UUID.randomUUID().toString().replace("-", "");
        session.setAttribute(VISITOR_KEY, createdVisitorKey);
        return createdVisitorKey;
    }
}
