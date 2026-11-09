import { useState, type FormEvent } from "react";
import type { MemberDetail, MemberProfileUpdateRequest } from "@/features/auth/types/authTypes";

export const MemberProfileForm = ({ member, canEdit, isPending, onSave }: {
  member: MemberDetail;
  canEdit: boolean;
  isPending: boolean;
  onSave: (request: MemberProfileUpdateRequest) => Promise<void>;
}) => {
  const [memberName, setMemberName] = useState(member.memberName);
  const [email, setEmail] = useState(member.email);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave({ memberName, email });
  };

  return <form className="member-detail-form" onSubmit={submit}>
    <label>이름<input value={memberName} onChange={(event) => setMemberName(event.target.value)} maxLength={100} required disabled={!canEdit || isPending} /></label>
    <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} required disabled={!canEdit || isPending} /></label>
    {canEdit ? <button type="submit" disabled={isPending || (memberName === member.memberName && email === member.email)}>{isPending ? "저장 중..." : "정보 저장"}</button> : null}
  </form>;
};
