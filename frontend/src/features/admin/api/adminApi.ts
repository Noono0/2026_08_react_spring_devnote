import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { AdminMember, Grade, RolePermission, VisitAnalytics } from "@/features/admin/types/adminTypes";
import type { MemberGrade, MemberRole } from "@/features/auth/types/authTypes";

export const getAdminMembers = async (): Promise<AdminMember[]> => (await selectedHttpClient.get<ApiResponse<AdminMember[]>>("/admin/members")).data;
export const updateAdminMember = async (memberId: number, request: { grade: MemberGrade; role: MemberRole; accountStatus: string }): Promise<AdminMember> => (await selectedHttpClient.put<typeof request, ApiResponse<AdminMember>>(`/admin/members/${memberId}`, request)).data;
export const getGrades = async (): Promise<Grade[]> => (await selectedHttpClient.get<ApiResponse<Grade[]>>("/admin/grades")).data;
export const updateGrade = async (gradeCode: string, request: Omit<Grade, "gradeCode">): Promise<Grade> => (await selectedHttpClient.put<typeof request, ApiResponse<Grade>>(`/admin/grades/${gradeCode}`, request)).data;
export const getRolePermissions = async (): Promise<RolePermission[]> => (await selectedHttpClient.get<ApiResponse<RolePermission[]>>("/admin/permissions")).data;
export const updateRolePermission = async (role: string, permission: string, allowed: boolean): Promise<void> => { await selectedHttpClient.put(`/admin/permissions/${role}/${permission}`, { allowed }); };
export const getVisitAnalytics = async (): Promise<VisitAnalytics> => (await selectedHttpClient.get<ApiResponse<VisitAnalytics>>("/admin/analytics")).data;
