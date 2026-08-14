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
        adminDao.insertVisitorEvent(visitorKey, member == null ? null : member.getMemberId(), path.length() > 500 ? path.substring(0, 500) : path);
    }

    public String resolveVisitorKey(HttpServletRequest request) {
        HttpSession session = request.getSession(true);
        String visitorKey = (String) session.getAttribute(VISITOR_KEY);
        if (visitorKey != null) return visitorKey;

        String createdVisitorKey = UUID.randomUUID().toString().replace("-", "");
        session.setAttribute(VISITOR_KEY, createdVisitorKey);
        return createdVisitorKey;
    }
}
