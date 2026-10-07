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

/**
 * 관리자 기능(회원 관리, 등급, 역할 권한, 방문 통계)의 업무 규칙입니다.
 *
 * 모든 public 메서드의 첫 줄이 권한 검사다. 이 줄이 빠지면 누구나 그 기능을 쓸 수 있게 되므로
 * 새 메서드를 추가할 때도 반드시 requireAdministrator 또는 requireSuperAdministrator로 시작한다.
 */
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
        // 슈퍼관리자가 실수로 자기 권한을 내려 버리면 아무도 관리 화면에 들어올 수 없게 될 수 있어 막는다.
        if (currentAdmin.getMemberId().equals(memberId) && updateRequest.role() != MemberRole.SUPER_ADMIN) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "자신의 슈퍼관리자 권한은 해제할 수 없습니다.");
        }
        memberDao.updateMemberManagement(memberId, updateRequest.grade().name(), updateRequest.role().name(), updateRequest.accountStatus());
        // 바뀐 결과를 다시 읽어 돌려준다(updated_at 등 DB가 바꾼 값 포함).
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
        // 수정된 등급만 골라 돌려준다. orElseThrow: 위에서 1건 수정을 확인했으므로 비어 있을 수 없다.
        return getGrades(request).stream().filter(grade -> grade.gradeCode().equals(gradeCode)).findFirst().orElseThrow();
    }

    public List<RolePermissionResponse> getRolePermissions(HttpServletRequest request) {
        requireAdministrator(request);
        return adminDao.selectRolePermissions().stream().map(row -> new RolePermissionResponse(row.getMemberRole(), row.getPermissionCode(), row.getPermissionName(), row.getPermissionDescription(), "Y".equals(row.getAllowedYn()))).toList();
    }

    @Transactional
    public void updateRolePermission(String role, String permission, RolePermissionUpdateRequest updateRequest, HttpServletRequest request) {
        requireSuperAdministrator(request);
        // 슈퍼관리자 권한을 끄면 권한 화면 자체를 관리할 사람이 없어질 수 있어 막는다.
        if ("SUPER_ADMIN".equals(role) && !updateRequest.allowed()) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "슈퍼관리자의 기본 권한은 해제할 수 없습니다.");
        }
        // 주소로 들어온 역할 이름이 enum에 있는지 확인한다(valueOf는 없는 이름이면 IllegalArgumentException).
        try {
            MemberRole.valueOf(role);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.COMMON_INVALID_REQUEST, "지원하지 않는 회원 역할입니다.");
        }
        // permissions 테이블에 등록된 기능 코드인지 확인한다(없는 코드로 행이 생기는 것을 막는다).
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
                // visitorKey 전체는 세션을 구분하는 값이라 화면에는 앞 8글자만 보여 준다.
                row.getVisitorKey().substring(0, Math.min(8, row.getVisitorKey().length())), row.getMemberId(),
                row.getLoginId(), row.getMemberName(), row.getVisitedPath(), row.getVisitedAt())).toList());
    }

    /** 로그인했고 역할이 ADMIN 또는 SUPER_ADMIN이면 통과. 아니면 403(ACCESS_DENIED). */
    private MemberRow requireAdministrator(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        if (member == null || !MemberRole.valueOf(member.getMemberRole()).isAdministrator()) throw new BusinessException(ErrorCode.ACCESS_DENIED);
        return member;
    }

    /** 관리자 검사를 먼저 통과한 뒤, SUPER_ADMIN인지 한 번 더 확인한다(변경 기능용). */
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
