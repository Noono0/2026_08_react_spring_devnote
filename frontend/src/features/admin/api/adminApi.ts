/**
 * adminApi.ts — 관리자 화면 API 호출 (서버 AdminController와 1:1로 대응)
 * 각 함수는 "요청 → ApiResponse 받기 → .data만 꺼내기"를 한 줄로 쓴 것이다.
 * 권한이 없으면 서버가 403 오류를 돌려주고, 호출한 화면이 알림으로 보여 준다.
 */

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { AdminMember, Grade, RolePermission, VisitAnalytics } from "@/features/admin/types/adminTypes";
import type { MemberGrade, MemberRole } from "@/features/auth/types/authTypes";

// 회원 목록 / 회원 등급·역할·상태 변경
export const getAdminMembers = async (): Promise<AdminMember[]> => (await selectedHttpClient.get<ApiResponse<AdminMember[]>>("/admin/members")).data;
export const updateAdminMember = async (memberId: number, request: { grade: MemberGrade; role: MemberRole; accountStatus: string }): Promise<AdminMember> => (await selectedHttpClient.put<typeof request, ApiResponse<AdminMember>>(`/admin/members/${memberId}`, request)).data;
// 등급 목록 / 등급 수정. Omit<Grade, "gradeCode">: 등급 코드는 주소에 넣으므로 본문에서는 뺀다.
export const getGrades = async (): Promise<Grade[]> => (await selectedHttpClient.get<ApiResponse<Grade[]>>("/admin/grades")).data;
export const updateGrade = async (gradeCode: string, request: Omit<Grade, "gradeCode">): Promise<Grade> => (await selectedHttpClient.put<typeof request, ApiResponse<Grade>>(`/admin/grades/${gradeCode}`, request)).data;
// 역할별 기능 권한 표 / 한 칸 켜고 끄기
export const getRolePermissions = async (): Promise<RolePermission[]> => (await selectedHttpClient.get<ApiResponse<RolePermission[]>>("/admin/permissions")).data;
export const updateRolePermission = async (role: string, permission: string, allowed: boolean): Promise<void> => { await selectedHttpClient.put(`/admin/permissions/${role}/${permission}`, { allowed }); };
// 방문 통계
export const getVisitAnalytics = async (): Promise<VisitAnalytics> => (await selectedHttpClient.get<ApiResponse<VisitAnalytics>>("/admin/analytics")).data;
