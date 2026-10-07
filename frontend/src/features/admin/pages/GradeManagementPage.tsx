/**
 * GradeManagementPage.tsx — 관리자: 회원 등급(브론즈~다이아몬드)의 표시 이름과 시작 포인트 관리
 *
 * 조회는 관리자 모두, 저장은 슈퍼관리자만 할 수 있다(서버 AdminService가 최종 확인).
 * 화면에서는 슈퍼관리자가 아니면 저장 버튼을 비활성화해 "눌러도 실패할 동작"을 미리 막는다.
 */
import { useEffect, useState } from "react";
import { useGradesQuery, useUpdateGradeMutation } from "@/features/admin/hooks/useAdminQueries";
import type { Grade } from "@/features/admin/types/adminTypes";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";

/** 등급 하나를 고치는 카드. 입력 중인 값은 카드 안의 State로 따로 둔다(저장 전까지는 서버 데이터와 다를 수 있으므로). */
const GradeEditCard = ({ grade, editable }: { grade: Grade; editable: boolean }) => {
  const mutation = useUpdateGradeMutation();
  const [gradeName, setGradeName] = useState(grade.gradeName);
  const [minimumPoints, setMinimumPoints] = useState(grade.minimumPoints);
  // 저장 후 목록을 다시 받아 grade가 바뀌면 입력칸도 서버 값으로 맞춘다.
  useEffect(() => { setGradeName(grade.gradeName); setMinimumPoints(grade.minimumPoints); }, [grade]);

  // mutateAsync: 저장이 끝날 때까지 기다리고, 실패하면 예외를 던진다 → catch에서 서버 오류 메시지를 알림으로 보여 준다.
  const save = async (): Promise<void> => {
    try {
      await mutation.mutateAsync({ gradeCode: grade.gradeCode, request: { gradeName, minimumPoints, sortOrder: grade.sortOrder, active: grade.active } });
      applicationNotification.success("등급을 저장했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  // 저장 중이거나 권한이 없으면 버튼을 비활성화한다. Number(...)로 입력칸 문자열을 숫자로 바꾼다.
  return <article className="admin-edit-card"><span className={`member-grade grade-${grade.gradeCode.toLowerCase()}`}>{grade.gradeName}</span><label>표시 이름<input value={gradeName} onChange={(event) => setGradeName(event.target.value)} /></label><label>시작 포인트<input type="number" min="0" value={minimumPoints} onChange={(event) => setMinimumPoints(Number(event.target.value))} /></label><button type="button" disabled={!editable || mutation.isPending} onClick={() => void save()}>{mutation.isPending ? "저장 중..." : "저장"}</button></article>;
};

export const GradeManagementPage = () => {
  const gradesQuery = useGradesQuery();
  const sessionQuery = useAuthSessionQuery();
  // 로딩 → 오류 → 정상 순서로 먼저 끝낼 수 있는 경우를 처리한다(조기 반환).
  if (gradesQuery.isPending) return <div className="portfolio-state-panel">등급을 불러오는 중입니다.</div>;
  if (gradesQuery.isError) return <div className="portfolio-state-panel error-state">등급을 불러오지 못했습니다.</div>;
  // editable: 로그인 세션이 슈퍼관리자일 때만 true(화면 표시용 판단).
  return <section className="site-page"><div className="page-hero"><span className="page-kicker">Grade Management</span><div className="page-title-with-guide"><h1>등급관리</h1><FeatureHelpButton topic="grades" /></div><p>등급 체계는 미리 준비하고 포인트 적립 규칙은 추후 연결할 수 있습니다.</p></div><div className="admin-card-list">{gradesQuery.data.map((grade) => <GradeEditCard grade={grade} editable={sessionQuery.data?.superAdministrator === true} key={grade.gradeCode} />)}</div></section>;
};
