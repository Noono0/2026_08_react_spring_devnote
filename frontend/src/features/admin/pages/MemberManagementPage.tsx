import { useState } from "react";
import { useAdminMembersQuery, useUpdateMemberMutation } from "@/features/admin/hooks/useAdminQueries";
import type { AdminMember } from "@/features/admin/types/adminTypes";
import type { MemberGrade, MemberRole } from "@/features/auth/types/authTypes";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const grades: MemberGrade[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
const roles: MemberRole[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export const MemberManagementPage = () => {
  const membersQuery = useAdminMembersQuery();
  const sessionQuery = useAuthSessionQuery();
  const updateMutation = useUpdateMemberMutation();
  const [keyword, setKeyword] = useState("");

  const update = async (member: AdminMember, changes: Partial<{ grade: MemberGrade; role: MemberRole; accountStatus: string }>, message: string): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ memberId: member.memberId, grade: changes.grade ?? member.gradeCode, role: changes.role ?? member.memberRole, accountStatus: changes.accountStatus ?? member.accountStatus });
      applicationNotification.success(message);
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  if (membersQuery.isPending) return <div className="portfolio-state-panel">회원을 불러오는 중입니다.</div>;
  if (membersQuery.isError) return <div className="portfolio-state-panel error-state">회원 목록을 불러오지 못했습니다.</div>;
  const members = membersQuery.data.filter((member) => `${member.loginId} ${member.memberName} ${member.email}`.toLowerCase().includes(keyword.toLowerCase()));
  const editable = sessionQuery.data?.superAdministrator === true;
  return <section className="site-page"><div className="page-hero"><span className="page-kicker">Member Management</span><h1>회원관리</h1><p>비회원은 방문 이력만 남고, 가입 회원은 브론즈 등급과 USER 역할로 시작합니다.</p></div><label className="admin-search">회원 검색<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="아이디, 이름, 이메일" /></label><div className="admin-table-wrap"><table><thead><tr><th>회원</th><th>등급</th><th>역할</th><th>상태</th><th>최근 로그인</th></tr></thead><tbody>{members.map((member) => <tr key={member.memberId}><td><strong>{member.memberName}</strong><small>{member.loginId ?? "로그인 ID 없음"} · {member.email}</small></td><td><select value={member.gradeCode} disabled={!editable || updateMutation.isPending} onChange={(event) => void update(member, { grade: event.target.value as MemberGrade }, "회원 등급을 변경했습니다.")}>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></td><td><select value={member.memberRole} disabled={!editable || updateMutation.isPending} onChange={(event) => void update(member, { role: event.target.value as MemberRole }, "회원 역할을 변경했습니다.")}>{roles.map((role) => <option key={role}>{role}</option>)}</select></td><td><select value={member.accountStatus} disabled={!editable || updateMutation.isPending} onChange={(event) => void update(member, { accountStatus: event.target.value }, "계정 상태를 변경했습니다.")}><option>ACTIVE</option><option>LOCKED</option><option>WITHDRAWN</option></select></td><td>{member.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "-"}</td></tr>)}</tbody></table></div></section>;
};
