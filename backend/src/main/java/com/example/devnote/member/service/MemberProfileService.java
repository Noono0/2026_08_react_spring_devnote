package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.MemberDetailResponse;
import com.example.devnote.member.dto.MemberProfileUpdateRequest;
import com.example.devnote.member.dto.PasswordChangeRequest;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberProfileService {
    private final AuthenticationService authenticationService;
    private final MemberDao memberDao;
    private final MemberPasswordService passwordService;

    public MemberDetailResponse getOwnProfile(HttpServletRequest request) {
        return MemberDetailResponse.from(requireAuthenticated(request));
    }

    @Transactional
    public MemberDetailResponse updateOwnProfile(MemberProfileUpdateRequest updateRequest, HttpServletRequest request) {
        MemberRow member = requireAuthenticated(request);
        return saveProfile(member.getMemberId(), updateRequest);
    }

    @Transactional
    public void changeOwnPassword(PasswordChangeRequest changeRequest, HttpServletRequest request) {
        MemberRow member = requireAuthenticated(request);
        if (!passwordService.matches(changeRequest.currentPassword(), member.getPasswordHash())) {
            throw new BusinessException(ErrorCode.CURRENT_PASSWORD_INVALID);
        }
        memberDao.updateMemberPassword(member.getMemberId(), passwordService.encode(changeRequest.newPassword()));
    }

    public MemberDetailResponse getManagedProfile(Long memberId, HttpServletRequest request) {
        requireAdministrator(request);
        return MemberDetailResponse.from(findForManagement(memberId));
    }

    @Transactional
    public MemberDetailResponse updateManagedProfile(Long memberId, MemberProfileUpdateRequest updateRequest, HttpServletRequest request) {
        MemberRow actor = requireAdministrator(request);
        MemberRow target = findForManagement(memberId);
        // 일반 관리자는 일반 회원과 자신의 기본 정보만 바꿀 수 있다.
        if (!"SUPER_ADMIN".equals(actor.getMemberRole())
            && !"USER".equals(target.getMemberRole())
            && !actor.getMemberId().equals(target.getMemberId())) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }
        if (!"Y".equals(target.getUseYn())) throw new BusinessException(ErrorCode.MEMBER_NOT_FOUND);
        return saveProfile(memberId, updateRequest);
    }

    private MemberDetailResponse saveProfile(Long memberId, MemberProfileUpdateRequest updateRequest) {
        String email = updateRequest.email().trim().toLowerCase();
        try {
            if (memberDao.updateMemberProfile(memberId, updateRequest.memberName().trim(), email) == 0) {
                throw new BusinessException(ErrorCode.MEMBER_NOT_FOUND);
            }
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        return MemberDetailResponse.from(memberDao.selectMemberById(memberId));
    }

    private MemberRow findForManagement(Long memberId) {
        MemberRow member = memberDao.selectMemberForManagement(memberId);
        if (member == null) throw new BusinessException(ErrorCode.MEMBER_NOT_FOUND);
        return member;
    }

    private MemberRow requireAuthenticated(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        if (member == null) throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        return member;
    }

    private MemberRow requireAdministrator(HttpServletRequest request) {
        MemberRow member = requireAuthenticated(request);
        if (!"ADMIN".equals(member.getMemberRole()) && !"SUPER_ADMIN".equals(member.getMemberRole())) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }
        return member;
    }
}
