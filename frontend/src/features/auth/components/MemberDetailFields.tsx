import type { MemberDetail } from "@/features/auth/types/authTypes";

const formatDateTime = (value: string | null) => value ? value.slice(0, 16).replace("T", " ") : "기록 없음";

export const MemberDetailFields = ({ member }: { member: MemberDetail }) => <dl className="member-detail-fields">
  <div><dt>회원 번호</dt><dd>{member.memberId}</dd></div>
  <div><dt>아이디</dt><dd>{member.loginId ?? "로그인 ID 없음"}</dd></div>
  <div><dt>등급</dt><dd>{member.gradeCode}</dd></div>
  <div><dt>역할</dt><dd>{member.memberRole}</dd></div>
  <div><dt>상태</dt><dd>{member.accountStatus}</dd></div>
  <div><dt>사용 여부</dt><dd>{member.useYn === "Y" ? "사용 중" : "삭제 표시"}</dd></div>
  <div><dt>가입일</dt><dd>{formatDateTime(member.createdAt)}</dd></div>
  <div><dt>최근 로그인</dt><dd>{formatDateTime(member.lastLoginAt)}</dd></div>
  <div><dt>최근 수정</dt><dd>{formatDateTime(member.updatedAt)}</dd></div>
</dl>;
