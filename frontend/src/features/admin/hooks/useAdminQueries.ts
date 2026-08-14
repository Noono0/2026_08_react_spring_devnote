import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminMembers, getGrades, getRolePermissions, getVisitAnalytics, updateAdminMember, updateGrade, updateRolePermission } from "@/features/admin/api/adminApi";
import type { Grade } from "@/features/admin/types/adminTypes";
import type { MemberGrade, MemberRole } from "@/features/auth/types/authTypes";

export const useAdminMembersQuery = () => useQuery({ queryKey: ["admin", "members"], queryFn: getAdminMembers });
export const useGradesQuery = () => useQuery({ queryKey: ["admin", "grades"], queryFn: getGrades });
export const useRolePermissionsQuery = () => useQuery({ queryKey: ["admin", "permissions"], queryFn: getRolePermissions });
export const useVisitAnalyticsQuery = () => useQuery({ queryKey: ["admin", "analytics"], queryFn: getVisitAnalytics });
export const useUpdateMemberMutation = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ memberId, grade, role, accountStatus }: { memberId: number; grade: MemberGrade; role: MemberRole; accountStatus: string }) => updateAdminMember(memberId, { grade, role, accountStatus }), onSuccess: async () => client.invalidateQueries({ queryKey: ["admin", "members"] }) }); };
export const useUpdateGradeMutation = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ gradeCode, request }: { gradeCode: string; request: Omit<Grade, "gradeCode"> }) => updateGrade(gradeCode, request), onSuccess: async () => client.invalidateQueries({ queryKey: ["admin", "grades"] }) }); };
export const useUpdatePermissionMutation = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ role, permission, allowed }: { role: string; permission: string; allowed: boolean }) => updateRolePermission(role, permission, allowed), onSuccess: async () => client.invalidateQueries({ queryKey: ["admin", "permissions"] }) }); };
