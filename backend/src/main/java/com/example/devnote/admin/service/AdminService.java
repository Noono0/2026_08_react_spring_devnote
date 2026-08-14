package com.example.devnote.admin.service;

import com.example.devnote.admin.dao.AdminDao;
import com.example.devnote.admin.dao.row.VisitSeriesRow;
import com.example.devnote.admin.dto.*;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.MemberRole;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {
    private final AuthenticationService authenticationService;
    private final MemberDao memberDao;
    private final AdminDao adminDao;

    public List<AdminMemberResponse> getMembers(HttpServletRequest request) {
        requireAdministrator(request);
        return memberDao.selectAllMembers().stream().map(this::toMemberResponse).toList();
    }

    @Transactional
    public AdminMemberResponse updateMember(Long memberId, MemberManagementUpdateRequest updateRequest, HttpServletRequest request) {
        MemberRow currentAdmin = requireSuperAdministrator(request);
        MemberRow target = memberDao.selectMemberById(memberId);
        if (target == null) throw new BusinessException(ErrorCode.MEMBER_NOT_FOUND);
        if (currentAdmin.getMemberId().equals(memberId) && updateRequest.role() != MemberRole.SUPER_ADMIN) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "자신의 슈퍼관리자 권한은 해제할 수 없습니다.");
        }
        memberDao.updateMemberManagement(memberId, updateRequest.grade().name(), updateRequest.role().name(), updateRequest.accountStatus());
        return toMemberResponse(memberDao.selectMemberById(memberId));
    }

    public List<GradeResponse> getGrades(HttpServletRequest request) {
        requireAdministrator(request);
        return adminDao.selectGrades().stream().map(row -> new GradeResponse(row.getGradeCode(), row.getGradeName(), row.getMinimumPoints(), row.getSortOrder(), "Y".equals(row.getUseYn()))).toList();
    }

    @Transactional
    public GradeResponse updateGrade(String gradeCode, GradeUpdateRequest updateRequest, HttpServletRequest request) {
        requireSuperAdministrator(request);
        if (adminDao.updateGrade(gradeCode, updateRequest.gradeName().trim(), updateRequest.minimumPoints(), updateRequest.sortOrder(), updateRequest.active() ? "Y" : "N") == 0) {
            throw new BusinessException(ErrorCode.COMMON_RESOURCE_NOT_FOUND, "회원 등급을 찾을 수 없습니다.");
        }
        return getGrades(request).stream().filter(grade -> grade.gradeCode().equals(gradeCode)).findFirst().orElseThrow();
    }

    public List<RolePermissionResponse> getRolePermissions(HttpServletRequest request) {
        requireAdministrator(request);
        return adminDao.selectRolePermissions().stream().map(row -> new RolePermissionResponse(row.getMemberRole(), row.getPermissionCode(), row.getPermissionName(), row.getPermissionDescription(), "Y".equals(row.getAllowedYn()))).toList();
    }

    @Transactional
    public void updateRolePermission(String role, String permission, RolePermissionUpdateRequest updateRequest, HttpServletRequest request) {
        requireSuperAdministrator(request);
        if ("SUPER_ADMIN".equals(role) && !updateRequest.allowed()) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "슈퍼관리자의 기본 권한은 해제할 수 없습니다.");
        }
        try {
            MemberRole.valueOf(role);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "지원하지 않는 회원 역할입니다.");
        }
        boolean permissionExists = adminDao.selectRolePermissions().stream()
            .anyMatch(item -> item.getPermissionCode().equals(permission));
        if (!permissionExists) throw new BusinessException(ErrorCode.COMMON_RESOURCE_NOT_FOUND, "기능 권한을 찾을 수 없습니다.");
        adminDao.upsertRolePermission(role, permission, updateRequest.allowed() ? "Y" : "N");
    }

    public VisitAnalyticsResponse getAnalytics(HttpServletRequest request) {
        requireAdministrator(request);
        return new VisitAnalyticsResponse(adminDao.selectTodayVisitorCount(), adminDao.selectMonthVisitorCount(),
            adminDao.selectDailyVisitSeries().stream().map(this::toSeries).toList(),
            adminDao.selectMonthlyVisitSeries().stream().map(this::toSeries).toList(),
            adminDao.selectRecentVisits().stream().map(row -> new RecentVisitResponse(
                row.getVisitorKey().substring(0, Math.min(8, row.getVisitorKey().length())), row.getMemberId(),
                row.getLoginId(), row.getMemberName(), row.getVisitedPath(), row.getVisitedAt())).toList());
    }

    private MemberRow requireAdministrator(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        if (member == null || !MemberRole.valueOf(member.getMemberRole()).isAdministrator()) throw new BusinessException(ErrorCode.ACCESS_DENIED);
        return member;
    }

    private MemberRow requireSuperAdministrator(HttpServletRequest request) {
        MemberRow member = requireAdministrator(request);
        if (!"SUPER_ADMIN".equals(member.getMemberRole())) throw new BusinessException(ErrorCode.ACCESS_DENIED, "슈퍼관리자만 변경할 수 있습니다.");
        return member;
    }

    private AdminMemberResponse toMemberResponse(MemberRow member) {
        return new AdminMemberResponse(member.getMemberId(), member.getLoginId(), member.getEmail(), member.getMemberName(), member.getMemberRole(), member.getGradeCode(), member.getAccountStatus(), member.getLastLoginAt(), member.getCreatedAt());
    }
    private VisitSeriesItem toSeries(VisitSeriesRow row) { return new VisitSeriesItem(row.getPeriod(), row.getVisitors(), row.getPageViews()); }
}
