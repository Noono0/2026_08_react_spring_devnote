import { useState, type FormEvent } from "react";
import { MemberDetailFields } from "@/features/auth/components/MemberDetailFields";
import { MemberProfileForm } from "@/features/auth/components/MemberProfileForm";
import { useChangeOwnPasswordMutation, useOwnAccountQuery, useUpdateOwnAccountMutation } from "@/features/auth/hooks/useAccountQueries";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";

export const OwnAccountPage = () => {
  const accountQuery = useOwnAccountQuery();
  const updateMutation = useUpdateOwnAccountMutation();
  const passwordMutation = useChangeOwnPasswordMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      applicationNotification.error("새 비밀번호와 확인 값이 다릅니다.");
      return;
    }
    try {
      await passwordMutation.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      applicationNotification.success("비밀번호를 변경했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  if (accountQuery.isPending) return <div className="portfolio-state-panel">내 계정을 불러오는 중입니다.</div>;
  if (accountQuery.isError) return <div className="portfolio-state-panel error-state" role="alert">내 계정을 불러오지 못했습니다.</div>;
  const member = accountQuery.data;

  return <section className="site-page"><div className="page-hero"><span className="page-kicker">My Account</span><h1>내 계정</h1><p>이름과 이메일을 수정하고 비밀번호를 변경할 수 있습니다.</p></div>
    <div className="member-detail-layout">
      <section className="member-detail-card"><h2>회원 정보</h2><MemberDetailFields member={member} /><MemberProfileForm key={member.updatedAt} member={member} canEdit isPending={updateMutation.isPending} onSave={async (request) => {
        try { await updateMutation.mutateAsync(request); applicationNotification.success("내 정보를 저장했습니다."); }
        catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
      }} /></section>
      <section className="member-detail-card"><h2>비밀번호 변경</h2><form className="member-detail-form" onSubmit={(event) => void changePassword(event)}>
        <label>현재 비밀번호<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
        <label>새 비밀번호<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={200} required /></label>
        <label>새 비밀번호 확인<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={200} required /></label>
        <button type="submit" disabled={passwordMutation.isPending}>{passwordMutation.isPending ? "변경 중..." : "비밀번호 변경"}</button>
      </form></section>
    </div>
  </section>;
};
