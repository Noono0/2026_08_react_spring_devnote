package com.example.devnote.admin.controller;

import com.example.devnote.admin.dto.*;
import com.example.devnote.admin.service.AdminService;
import com.example.devnote.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {
    private final AdminService adminService;

    @GetMapping("/members") public ApiResponse<List<AdminMemberResponse>> getMembers(HttpServletRequest request) { return ApiResponse.success(adminService.getMembers(request)); }
    @PutMapping("/members/{memberId}") public ApiResponse<AdminMemberResponse> updateMember(@PathVariable Long memberId, @Valid @RequestBody MemberManagementUpdateRequest updateRequest, HttpServletRequest request) { return ApiResponse.success(adminService.updateMember(memberId, updateRequest, request)); }
    @GetMapping("/grades") public ApiResponse<List<GradeResponse>> getGrades(HttpServletRequest request) { return ApiResponse.success(adminService.getGrades(request)); }
    @PutMapping("/grades/{gradeCode}") public ApiResponse<GradeResponse> updateGrade(@PathVariable String gradeCode, @Valid @RequestBody GradeUpdateRequest updateRequest, HttpServletRequest request) { return ApiResponse.success(adminService.updateGrade(gradeCode, updateRequest, request)); }
    @GetMapping("/permissions") public ApiResponse<List<RolePermissionResponse>> getPermissions(HttpServletRequest request) { return ApiResponse.success(adminService.getRolePermissions(request)); }
    @PutMapping("/permissions/{role}/{permission}") public ApiResponse<Void> updatePermission(@PathVariable String role, @PathVariable String permission, @RequestBody RolePermissionUpdateRequest updateRequest, HttpServletRequest request) { adminService.updateRolePermission(role, permission, updateRequest, request); return ApiResponse.success(null); }
    @GetMapping("/analytics") public ApiResponse<VisitAnalyticsResponse> getAnalytics(HttpServletRequest request) { return ApiResponse.success(adminService.getAnalytics(request)); }
}
