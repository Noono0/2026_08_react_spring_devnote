import { useEffect, useState } from "react";
import { useGradesQuery, useUpdateGradeMutation } from "@/features/admin/hooks/useAdminQueries";
import type { Grade } from "@/features/admin/types/adminTypes";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const GradeEditCard = ({ grade, editable }: { grade: Grade; editable: boolean }) => {
  const mutation = useUpdateGradeMutation();
  const [gradeName, setGradeName] = useState(grade.gradeName);
  const [minimumPoints, setMinimumPoints] = useState(grade.minimumPoints);
  useEffect(() => { setGradeName(grade.gradeName); setMinimumPoints(grade.minimumPoints); }, [grade]);

  const save = async (): Promise<void> => {
    try {
      await mutation.mutateAsync({ gradeCode: grade.gradeCode, request: { gradeName, minimumPoints, sortOrder: grade.sortOrder, active: grade.active } });
      applicationNotification.success("등급을 저장했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  return <article className="admin-edit-card"><span className={`member-grade grade-${grade.gradeCode.toLowerCase()}`}>{grade.gradeName}</span><label>표시 이름<input value={gradeName} onChange={(event) => setGradeName(event.target.value)} /></label><label>시작 포인트<input type="number" min="0" value={minimumPoints} onChange={(event) => setMinimumPoints(Number(event.target.value))} /></label><button type="button" disabled={!editable || mutation.isPending} onClick={() => void save()}>{mutation.isPending ? "저장 중..." : "저장"}</button></article>;
};

export const GradeManagementPage = () => {
  const gradesQuery = useGradesQuery();
  const sessionQuery = useAuthSessionQuery();
  if (gradesQuery.isPending) return <div className="portfolio-state-panel">등급을 불러오는 중입니다.</div>;
  if (gradesQuery.isError) return <div className="portfolio-state-panel error-state">등급을 불러오지 못했습니다.</div>;
  return <section className="site-page"><div className="page-hero"><span className="page-kicker">Grade Management</span><h1>등급관리</h1><p>등급 체계는 미리 준비하고 포인트 적립 규칙은 추후 연결할 수 있습니다.</p></div><div className="admin-card-list">{gradesQuery.data.map((grade) => <GradeEditCard grade={grade} editable={sessionQuery.data?.superAdministrator === true} key={grade.gradeCode} />)}</div></section>;
};
