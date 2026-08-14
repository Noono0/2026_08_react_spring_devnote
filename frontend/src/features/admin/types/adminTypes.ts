import type { MemberGrade, MemberRole } from "@/features/auth/types/authTypes";

export interface AdminMember { memberId: number; loginId?: string; email: string; memberName: string; memberRole: MemberRole; gradeCode: MemberGrade; accountStatus: "ACTIVE" | "LOCKED" | "WITHDRAWN"; lastLoginAt?: string; createdAt: string; }
export interface Grade { gradeCode: MemberGrade; gradeName: string; minimumPoints: number; sortOrder: number; active: boolean; }
export interface RolePermission { memberRole: MemberRole; permissionCode: string; permissionName: string; permissionDescription?: string; allowed: boolean; }
export interface VisitSeries { period: string; visitors: number; pageViews: number; }
export interface RecentVisit { visitorKey: string; memberId?: number; loginId?: string; memberName?: string; visitedPath: string; visitedAt: string; }
export interface VisitAnalytics { todayVisitors: number; monthVisitors: number; daily: VisitSeries[]; monthly: VisitSeries[]; recentVisits: RecentVisit[]; }
