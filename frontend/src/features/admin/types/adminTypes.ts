import type { MemberGrade, MemberRole } from "@/features/auth/types/authTypes";

// adminTypes.ts — 관리자 화면 응답 타입(서버 admin/dto의 record와 같은 모양: AdminMemberResponse, GradeResponse …)
// 서버에서 Java 필드 이름을 바꾸면 여기도 함께 바꿔야 화면에 값이 비어 보이지 않는다.
export interface AdminMember { memberId: number; loginId?: string; email: string; memberName: string; memberRole: MemberRole; gradeCode: MemberGrade; accountStatus: "ACTIVE" | "LOCKED" | "WITHDRAWN"; lastLoginAt?: string; createdAt: string; }
export interface Grade { gradeCode: MemberGrade; gradeName: string; minimumPoints: number; sortOrder: number; active: boolean; }
export interface RolePermission { memberRole: MemberRole; permissionCode: string; permissionName: string; permissionDescription?: string; allowed: boolean; }
export interface VisitSeries { period: string; visitors: number; pageViews: number; }
export interface RecentVisit { visitorKey: string; memberId?: number; loginId?: string; memberName?: string; visitedPath: string; visitedAt: string; }
export interface VisitAnalytics { todayVisitors: number; monthVisitors: number; daily: VisitSeries[]; monthly: VisitSeries[]; recentVisits: RecentVisit[]; }
