package com.example.devnote.admin.controller;

import com.example.devnote.admin.dto.*;
import com.example.devnote.admin.service.AdminService;
import com.example.devnote.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 관리자 화면 API입니다. (/api/v1/admin)
 *
 * [권한] 조회는 관리자(ADMIN·SUPER_ADMIN), 변경은 슈퍼관리자(SUPER_ADMIN)만 가능하다.
 *   권한 검사는 Controller가 아니라 AdminService의 requireAdministrator / requireSuperAdministrator가 한다.
 *   그래서 모든 메서드가 HttpServletRequest(로그인 세션을 꺼낼 재료)를 Service에 넘긴다.
 *
 * 각 메서드가 한 줄인 이유: Controller는 "주소 연결 + Service 호출"만 하므로 짧게 모아 API 목록처럼 읽히게 했다.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {
    private final AdminService adminService;

    // 회원 목록 조회 / 회원 등급·역할·상태 변경
    @GetMapping("/members") public ApiResponse<List<AdminMemberResponse>> getMembers(HttpServletRequest request) { return ApiResponse.success(adminService.getMembers(request)); }
    @PutMapping("/members/{memberId}") public ApiResponse<AdminMemberResponse> updateMember(@PathVariable Long memberId, @Valid @RequestBody MemberManagementUpdateRequest updateRequest, HttpServletRequest request) { return ApiResponse.success(adminService.updateMember(memberId, updateRequest, request)); }
    // 회원 등급 표(이름·기준 점수·순서) 조회 / 변경
    @GetMapping("/grades") public ApiResponse<List<GradeResponse>> getGrades(HttpServletRequest request) { return ApiResponse.success(adminService.getGrades(request)); }
    @PutMapping("/grades/{gradeCode}") public ApiResponse<GradeResponse> updateGrade(@PathVariable String gradeCode, @Valid @RequestBody GradeUpdateRequest updateRequest, HttpServletRequest request) { return ApiResponse.success(adminService.updateGrade(gradeCode, updateRequest, request)); }
    // 역할별 기능 권한 표 조회 / 한 칸(역할 × 기능) 켜고 끄기
    @GetMapping("/permissions") public ApiResponse<List<RolePermissionResponse>> getPermissions(HttpServletRequest request) { return ApiResponse.success(adminService.getRolePermissions(request)); }
    @PutMapping("/permissions/{role}/{permission}") public ApiResponse<Void> updatePermission(@PathVariable String role, @PathVariable String permission, @RequestBody RolePermissionUpdateRequest updateRequest, HttpServletRequest request) { adminService.updateRolePermission(role, permission, updateRequest, request); return ApiResponse.success(null); }
    // 방문 통계(오늘·이번 달 방문자, 최근 14일·12개월 추이, 최근 방문 50건)
    @GetMapping("/analytics") public ApiResponse<VisitAnalyticsResponse> getAnalytics(HttpServletRequest request) { return ApiResponse.success(adminService.getAnalytics(request)); }
}
