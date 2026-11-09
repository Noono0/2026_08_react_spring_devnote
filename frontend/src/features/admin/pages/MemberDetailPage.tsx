import { Link, useParams } from "react-router-dom";
import { MemberDetailFields } from "@/features/auth/components/MemberDetailFields";
import { MemberProfileForm } from "@/features/auth/components/MemberProfileForm";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { useAdminMemberQuery, useUpdateMemberMutation, useUpdateMemberProfileMutation } from "@/features/admin/hooks/useAdminQueries";
import type { MemberDetail, MemberGrade, MemberRole } from "@/features/auth/types/authTypes";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const grades: MemberGrade[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
const roles: MemberRole[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export const MemberDetailPage = () => {
  const { memberId: memberIdParam } = useParams();
  const memberId = Number(memberIdParam);
  const detailQuery = useAdminMemberQuery(memberId);
  const sessionQuery = useAuthSessionQuery();
  const profileMutation = useUpdateMemberProfileMutation();
  const managementMutation = useUpdateMemberMutation();

  const changeManagement = async (member: MemberDetail, changes: Partial<{ grade: MemberGrade; role: MemberRole; accountStatus: string }>) => {
    try {
      await managementMutation.mutateAsync({ memberId: member.memberId, grade: changes.grade ?? member.gradeCode, role: changes.role ?? member.memberRole, accountStatus: changes.accountStatus ?? member.accountStatus });
      applicationNotification.success("회원 권한 정보를 변경했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  if (!Number.isSafeInteger(memberId) || memberId <= 0) return <div className="portfolio-state-panel error-state" role="alert">올바른 회원 번호가 아닙니다.</div>;
  if (detailQuery.isPending) return <div className="portfolio-state-panel">회원 상세정보를 불러오는 중입니다.</div>;
  if (detailQuery.isError) return <div className="portfolio-state-panel error-state" role="alert">회원 상세정보를 불러오지 못했습니다.</div>;
  const member = detailQuery.data;
  const isSelf = sessionQuery.data?.memberId === member.memberId;
  const isSuperAdmin = sessionQuery.data?.superAdministrator === true;
  const canEditProfile = member.useYn === "Y" && (isSuperAdmin || member.memberRole === "USER" || isSelf);

  return <section className="site-page"><div className="page-hero"><span className="page-kicker">Member Detail</span><h1>회원 상세정보</h1><p><Link to="/admin/members">← 회원 목록으로</Link></p></div>
    <div className="member-detail-layout"><section className="member-detail-card"><h2>{member.memberName}</h2><MemberDetailFields member={member} />
      <h3>기본 정보</h3><MemberProfileForm key={member.updatedAt} member={member} canEdit={canEditProfile} isPending={profileMutation.isPending} onSave={async (request) => {
        try { await profileMutation.mutateAsync({ memberId, request }); applicationNotification.success("회원 정보를 저장했습니다."); }
        catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
      }} />
      {!canEditProfile ? <p>이 계정의 기본 정보는 수정할 수 없습니다.</p> : null}
    </section>
    {isSuperAdmin && member.useYn === "Y" ? <section className="member-detail-card"><h2>권한과 상태</h2><p>선택하면 바로 저장됩니다.</p><div className="member-detail-form">
      <label>등급<select value={member.gradeCode} disabled={managementMutation.isPending} onChange={(event) => void changeManagement(member, { grade: event.target.value as MemberGrade })}>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
      <label>역할<select value={member.memberRole} disabled={managementMutation.isPending} onChange={(event) => void changeManagement(member, { role: event.target.value as MemberRole })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
      <label>계정 상태<select value={member.accountStatus} disabled={managementMutation.isPending} onChange={(event) => void changeManagement(member, { accountStatus: event.target.value })}><option>ACTIVE</option><option>LOCKED</option><option>WITHDRAWN</option></select></label>
    </div></section> : null}</div>
  </section>;
};
