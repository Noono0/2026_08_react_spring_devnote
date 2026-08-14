import { useState } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { PortfolioSectionEditor } from "@/features/portfolio/components/PortfolioSectionEditor";
import {
  useCreatePortfolioSectionMutation,
  useDeletePortfolioSectionMutation,
  usePortfolioSectionsQuery,
  useUpdatePortfolioSectionMutation,
} from "@/features/portfolio/hooks/usePortfolioQueries";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import type { PortfolioSection, PortfolioSectionSaveRequest } from "@/features/portfolio/types/portfolioTypes";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";

const sectionTypeLabelMap: Record<PortfolioSection["sectionType"], string> = {
  PROFILE: "내 정보",
  RICH_TEXT: "자유 글",
  EXPERIENCE: "경력",
  PROJECT: "프로젝트",
  SKILL: "기술 스택",
};

const formatPeriod = (section: PortfolioSection): string | undefined => {
  if (!section.startDate) return undefined;
  return `${section.startDate.slice(0, 7)} ~ ${section.current ? "현재" : section.endDate?.slice(0, 7) ?? ""}`;
};

export const PortfolioHomePage = () => {
  const sectionsQuery = usePortfolioSectionsQuery();
  const authSessionQuery = useAuthSessionQuery();
  const createMutation = useCreatePortfolioSectionMutation();
  const updateMutation = useUpdatePortfolioSectionMutation();
  const deleteMutation = useDeletePortfolioSectionMutation();
  const [editingSection, setEditingSection] = useState<PortfolioSection>();
  const [isSectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioSection>();
  const isEditMode = authSessionQuery.data?.superAdministrator === true;
  const sections = sectionsQuery.data ?? [];

  const saveSection = async (request: PortfolioSectionSaveRequest): Promise<void> => {
    try {
      if (editingSection) {
        await updateMutation.mutateAsync({ id: editingSection.portfolioSectionId, request });
      } else {
        await createMutation.mutateAsync(request);
      }
      setSectionEditorOpen(false);
      setEditingSection(undefined);
      applicationNotification.success(editingSection ? "포트폴리오 섹션을 수정했습니다." : "포트폴리오 섹션을 추가했습니다.");
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    }
  };

  const deleteSection = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.portfolioSectionId, version: deleteTarget.versionNumber });
      setDeleteTarget(undefined);
      applicationNotification.success("포트폴리오 섹션을 삭제했습니다.");
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    }
  };

  if (sectionsQuery.isPending || authSessionQuery.isPending) {
    return <div className="portfolio-state-panel">포트폴리오를 불러오는 중입니다.</div>;
  }
  if (sectionsQuery.isError) {
    return (
      <div className="portfolio-state-panel error-state" role="alert">
        <h1>포트폴리오를 불러오지 못했습니다.</h1>
        <button type="button" onClick={() => void sectionsQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  return (
    <>
      <section className="portfolio-page">
        <div className="portfolio-owner-toolbar">
          {isEditMode ? (
            <>
              <span className="portfolio-edit-badge">슈퍼관리자 편집 모드</span>
              <button type="button" onClick={() => { setEditingSection(undefined); setSectionEditorOpen(true); }}>+ 섹션 추가</button>
            </>
          ) : null}
        </div>

        {sections.length === 0 ? (
          <div className="portfolio-empty-state">
            <h1>아직 공개된 포트폴리오 섹션이 없습니다.</h1>
            <p>{isEditMode ? "섹션 추가 버튼으로 첫 내용을 만들어 보세요." : "곧 새로운 내용을 준비하겠습니다."}</p>
          </div>
        ) : sections.map((section) => {
          const period = formatPeriod(section);
          return (
            <article key={section.portfolioSectionId} className={`portfolio-section portfolio-section-${section.sectionType.toLowerCase()}${section.visibility === "HIDDEN" ? " portfolio-section-hidden" : ""}`}>
              {isEditMode ? (
                <div className="portfolio-section-controls">
                  <span>{sectionTypeLabelMap[section.sectionType]} · {section.visibility === "PUBLIC" ? "공개" : "나만 보기"}</span>
                  <div className="button-row compact-button-row">
                    <button type="button" className="secondary-button" onClick={() => { setEditingSection(section); setSectionEditorOpen(true); }}>수정</button>
                    <button type="button" className="danger-button" onClick={() => setDeleteTarget(section)}>삭제</button>
                  </div>
                </div>
              ) : null}

              {section.thumbnailImageUrl ? (
                <div className="portfolio-section-image">
                  <img src={section.thumbnailImageUrl} alt={`${section.sectionTitle} 대표 이미지`} />
                </div>
              ) : null}

              <div className="portfolio-section-copy">
                <span className="portfolio-section-kicker">{sectionTypeLabelMap[section.sectionType]}{period ? ` · ${period}` : ""}</span>
                <h2>{section.sectionTitle}</h2>
                {section.sectionSubtitle ? <p className="portfolio-section-subtitle">{section.sectionSubtitle}</p> : null}
                {section.contentMode !== "STRUCTURED" && section.contentHtml ? (
                  <div className="portfolio-rich-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.contentHtml) }} />
                ) : null}
                {section.externalUrl ? <a className="secondary-link" href={section.externalUrl} target="_blank" rel="noreferrer">관련 링크 열기</a> : null}
              </div>
            </article>
          );
        })}

        <section className="portfolio-react-lab-callout">
          <div>
            <span className="portfolio-section-kicker">React Practice Lab</span>
            <h2>React 왕초보부터 고급 실무 시나리오까지</h2>
            <p>상태, 폼, Effect, 비동기, 접근성과 실제 Spring Boot API를 단계별 예제로 정리했습니다.</p>
          </div>
          <Link className="primary-link" to="/react">React 학습 로드맵 보기</Link>
        </section>
      </section>

      <PortfolioSectionEditor
        isOpen={isSectionEditorOpen}
        section={editingSection}
        nextSortOrder={(sections.at(-1)?.sortOrder ?? 0) + 1}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onSave={saveSection}
        onClose={() => { setSectionEditorOpen(false); setEditingSection(undefined); }}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="포트폴리오 섹션 삭제"
        description={`“${deleteTarget?.sectionTitle ?? ""}” 섹션을 삭제할까요?`}
        confirmButtonLabel="삭제"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => void deleteSection()}
        onCancel={() => setDeleteTarget(undefined)}
      />
    </>
  );
};
