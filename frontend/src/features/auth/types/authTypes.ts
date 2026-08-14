export type MemberRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type MemberGrade = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

export interface AuthSession {
  authenticated: boolean;
  memberId?: number;
  loginId?: string;
  memberName: string;
  email?: string;
  grade?: MemberGrade;
  role?: MemberRole;
  administrator: boolean;
  superAdministrator: boolean;
}

export interface RegisterRequest {
  loginId: string;
  password: string;
  memberName: string;
  email: string;
}

export interface LoginRequest {
  loginId: string;
  password: string;
  autoLogin: boolean;
}
