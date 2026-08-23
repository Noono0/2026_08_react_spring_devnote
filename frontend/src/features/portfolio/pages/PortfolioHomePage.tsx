import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { updatePortfolioSection } from "@/features/portfolio/api/portfolioApi";
import { PortfolioSectionCard } from "@/features/portfolio/components/PortfolioSectionCard";
import { PortfolioSectionEditor } from "@/features/portfolio/components/PortfolioSectionEditor";
import {
  useCreatePortfolioSectionMutation,
  useDeletePortfolioSectionMutation,
  usePortfolioSectionsQuery,
  useUpdatePortfolioSectionMutation,
} from "@/features/portfolio/hooks/usePortfolioQueries";
import type {
  PortfolioSection,
  PortfolioSectionSaveRequest,
  PortfolioSectionType,
} from "@/features/portfolio/types/portfolioTypes";
import {
  portfolioSectionGroups,
  sortPortfolioBlocks,
  toPortfolioSectionSaveRequest,
  type PortfolioBlockSectionType,
} from "@/features/portfolio/utils/portfolioSectionPresentation";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

const blockIconMap: Record<PortfolioBlockSectionType, string> = {
  PROFILE: "P",
  RICH_TEXT: "T",
  IMAGE: "▧",
  SKILL: "#",
  EXPERIENCE: "▤",
  PROJECT: "◇",
  EDUCATION: "E",
  CERTIFICATE: "✓",
  CONTACT: "@",
};

const portfolioQueryKey = ["portfolio", "sections"] as const;

/**
 * 포트폴리오를 하나의 고정 양식에 가두지 않고 여러 CRUD 섹션을 블록처럼 배치합니다.
 * 외부 유료 템플릿 없이 프로젝트가 직접 관리하는 블록형 UI입니다.
 */
export const PortfolioHomePage = () => {
  const queryClient = useQueryClient();
  const sectionsQuery = usePortfolioSectionsQuery();
  const authSessionQuery = useAuthSessionQuery();
  const createMutation = useCreatePortfolioSectionMutation();
  const updateMutation = useUpdatePortfolioSectionMutation();
  const deleteMutation = useDeletePortfolioSectionMutation();
  const blockSearchInputReference = useRef<HTMLInputElement>(null);

  const [isSectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<PortfolioSection>();
  const [initialSectionType, setInitialSectionType] = useState<PortfolioSectionType>("RICH_TEXT");
  const [deleteTarget, setDeleteTarget] = useState<PortfolioSection>();
  const [isBlockPickerOpen, setBlockPickerOpen] = useState(false);
  const [blockSearchText, setBlockSearchText] = useState("");
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number>();
  const [visibilityPendingId, setVisibilityPendingId] = useState<number>();
  const [draggedSectionId, setDraggedSectionId] = useState<number>();
  const [dragOverSectionId, setDragOverSectionId] = useState<number>();
  const [isReordering, setReordering] = useState(false);

  const isEditMode = authSessionQuery.data?.superAdministrator === true;
  const sections = useMemo(() => sortPortfolioBlocks(
    sectionsQuery.data ?? [],
  ), [sectionsQuery.data]);
  const nextSortOrder = (sections.at(-1)?.sortOrder ?? 0) + 10;

  const filteredBlockGroups = useMemo(() => {
    const searchText = blockSearchText.trim().toLocaleLowerCase();
    if (!searchText) return portfolioSectionGroups;
    return portfolioSectionGroups.filter((group) => (
      `${group.title} ${group.description} ${group.eyebrow}`.toLocaleLowerCase().includes(searchText)
    ));
  }, [blockSearchText]);

  useEffect(() => {
    if (!isBlockPickerOpen) return;
    blockSearchInputReference.current?.focus();
  }, [isBlockPickerOpen]);

  useEffect(() => {
    if (!isEditMode) return;
    const openPickerWithSlash = (keyboardEvent: KeyboardEvent): void => {
      const target = keyboardEvent.target;
      if (keyboardEvent.key !== "/" || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      keyboardEvent.preventDefault();
      setPendingInsertIndex(sections.length);
      setBlockSearchText("");
      setBlockPickerOpen(true);
    };
    window.addEventListener("keydown", openPickerWithSlash);
    return () => window.removeEventListener("keydown", openPickerWithSlash);
  }, [isEditMode, sections.length]);

  const closeSectionEditor = (): void => {
    setSectionEditorOpen(false);
    setEditingSection(undefined);
    setPendingInsertIndex(undefined);
  };

  const openBlockPicker = (insertIndex = sections.length): void => {
    setPendingInsertIndex(insertIndex);
    setBlockSearchText("");
    setBlockPickerOpen(true);
  };

  const selectBlockType = (sectionType: PortfolioSectionType): void => {
    setInitialSectionType(sectionType);
    setEditingSection(undefined);
    setBlockPickerOpen(false);
    setSectionEditorOpen(true);
  };

  const persistBlockOrder = async (orderedSections: PortfolioSection[]): Promise<void> => {
    const changedSections = orderedSections.filter((section, index) => section.sortOrder !== (index + 1) * 10);
    if (changedSections.length === 0) return;
    await Promise.all(changedSections.map((section) => {
      const sectionIndex = orderedSections.findIndex((candidate) => candidate.portfolioSectionId === section.portfolioSectionId);
      return updatePortfolioSection(
        section.portfolioSectionId,
        toPortfolioSectionSaveRequest(section, { sortOrder: (sectionIndex + 1) * 10 }),
      );
    }));
    await queryClient.invalidateQueries({ queryKey: portfolioQueryKey });
  };

  const saveSection = async (saveRequest: PortfolioSectionSaveRequest): Promise<void> => {
    try {
      if (editingSection) {
        await updateMutation.mutateAsync({ id: editingSection.portfolioSectionId, request: saveRequest });
        applicationNotification.success("포트폴리오 블록을 수정했습니다.");
      } else {
        const createdSection = await createMutation.mutateAsync({ ...saveRequest, sortOrder: nextSortOrder });
        const insertIndex = Math.min(pendingInsertIndex ?? sections.length, sections.length);
        const nextSections = [...sections];
        nextSections.splice(insertIndex, 0, createdSection);
        await persistBlockOrder(nextSections);
        applicationNotification.success("포트폴리오 블록을 추가했습니다.");
      }
      closeSectionEditor();
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    }
  };

  const toggleVisibility = async (section: PortfolioSection): Promise<void> => {
    setVisibilityPendingId(section.portfolioSectionId);
    try {
      await updateMutation.mutateAsync({
        id: section.portfolioSectionId,
        request: toPortfolioSectionSaveRequest(section, {
          visibility: section.visibility === "PUBLIC" ? "HIDDEN" : "PUBLIC",
        }),
      });
      applicationNotification.success(section.visibility === "PUBLIC" ? "블록을 비공개로 전환했습니다." : "블록을 공개했습니다.");
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    } finally {
      setVisibilityPendingId(undefined);
    }
  };

  const duplicateSection = async (section: PortfolioSection): Promise<void> => {
    try {
      const duplicatedSection = await createMutation.mutateAsync({
        ...toPortfolioSectionSaveRequest(section, { sortOrder: nextSortOrder }),
        sectionTitle: `${section.sectionTitle} 복사본`,
        versionNumber: undefined,
      });
      const sourceIndex = sections.findIndex((candidate) => candidate.portfolioSectionId === section.portfolioSectionId);
      const nextSections = [...sections];
      nextSections.splice(sourceIndex + 1, 0, duplicatedSection);
      await persistBlockOrder(nextSections);
      applicationNotification.success("블록을 복제했습니다.");
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    }
  };

  const moveSection = async (sourceId: number, targetIndex: number): Promise<void> => {
    const sourceIndex = sections.findIndex((section) => section.portfolioSectionId === sourceId);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= sections.length || sourceIndex === targetIndex || isReordering) return;
    const reorderedSections = [...sections];
    const [movedSection] = reorderedSections.splice(sourceIndex, 1);
    if (!movedSection) return;
    reorderedSections.splice(targetIndex, 0, movedSection);
    setReordering(true);
    try {
      await persistBlockOrder(reorderedSections);
      applicationNotification.success("블록 순서를 변경했습니다.");
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
      await sectionsQuery.refetch();
    } finally {
      setReordering(false);
      setDraggedSectionId(undefined);
      setDragOverSectionId(undefined);
    }
  };

  const deleteSection = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.portfolioSectionId, version: deleteTarget.versionNumber });
      setDeleteTarget(undefined);
      applicationNotification.success("포트폴리오 블록을 삭제했습니다.");
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
    <section className="portfolio-page portfolio-block-page">
      <header className="portfolio-document-heading">
        <div>
          <span className="portfolio-section-kicker">My portfolio · Custom blocks</span>
          <h1>포트폴리오</h1>
        </div>
        {isEditMode ? (
          <div className="portfolio-owner-toolbar">
            <span className="portfolio-edit-badge">슈퍼관리자 편집 가능</span>
            <span className="portfolio-owner-summary">{sections.length}개 블록</span>
            <button type="button" onClick={() => openBlockPicker()}>+ 블록 추가</button>
          </div>
        ) : null}
      </header>

      {isEditMode ? (
        <div className="portfolio-editor-guide">
          <span aria-hidden="true">+</span>
          <p><strong>자체 제작 블록 편집 모드</strong><br />블록 사이의 + 또는 <kbd>/</kbd> 키로 내용을 추가하고, 핸들이나 화살표로 순서를 바꿀 수 있습니다.</p>
        </div>
      ) : null}

      {sections.length === 0 ? (
        isEditMode ? (
          <button type="button" className="portfolio-first-block-button" onClick={() => openBlockPicker(0)}>
            <span aria-hidden="true">+</span>
            <strong>첫 블록 추가</strong>
            <small>소개, 이미지, 경력 등 원하는 형식으로 시작하세요.</small>
          </button>
        ) : (
          <div className="portfolio-empty-state">
            <h1>아직 공개된 포트폴리오가 없습니다.</h1>
            <p>경력과 프로젝트를 정리하고 있습니다. 곧 새로운 내용을 공개하겠습니다.</p>
          </div>
        )
      ) : (
        <div className="portfolio-block-list" aria-label="포트폴리오 블록 목록">
          {sections.map((section, index) => (
            <div className="portfolio-block-position" key={section.portfolioSectionId}>
              {isEditMode ? (
                <button type="button" className="portfolio-block-insert-button" onClick={() => openBlockPicker(index)} aria-label={`${section.sectionTitle} 앞에 블록 추가`}>
                  <span aria-hidden="true">+</span>
                </button>
              ) : null}
              <div
                className={`portfolio-block-shell${dragOverSectionId === section.portfolioSectionId ? " portfolio-block-drag-over" : ""}`}
                onDragOver={(event) => { if (isEditMode) { event.preventDefault(); setDragOverSectionId(section.portfolioSectionId); } }}
                onDrop={(event) => { event.preventDefault(); if (draggedSectionId !== undefined) void moveSection(draggedSectionId, index); }}
              >
                {isEditMode ? (
                  <div className="portfolio-block-move-controls" aria-label={`${section.sectionTitle} 순서 변경`}>
                    <button type="button" disabled={index === 0 || isReordering} onClick={() => void moveSection(section.portfolioSectionId, index - 1)} aria-label="위로 이동">↑</button>
                    <span
                      className="portfolio-block-drag-handle"
                      draggable={!isReordering}
                      onDragStart={() => setDraggedSectionId(section.portfolioSectionId)}
                      onDragEnd={() => { setDraggedSectionId(undefined); setDragOverSectionId(undefined); }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${section.sectionTitle} 드래그하여 이동`}
                    >⠿</span>
                    <button type="button" disabled={index === sections.length - 1 || isReordering} onClick={() => void moveSection(section.portfolioSectionId, index + 1)} aria-label="아래로 이동">↓</button>
                  </div>
                ) : null}
                <PortfolioSectionCard
                  section={section}
                  editable={isEditMode}
                  visibilityPending={visibilityPendingId === section.portfolioSectionId}
                  onEdit={(targetSection) => { setEditingSection(targetSection); setSectionEditorOpen(true); }}
                  onDuplicate={(targetSection) => void duplicateSection(targetSection)}
                  onDelete={setDeleteTarget}
                  onVisibilityToggle={(targetSection) => void toggleVisibility(targetSection)}
                />
              </div>
            </div>
          ))}
          {isEditMode ? (
            <button type="button" className="portfolio-block-insert-button portfolio-block-insert-button-last" onClick={() => openBlockPicker(sections.length)}>
              <span aria-hidden="true">+</span> 마지막에 블록 추가
            </button>
          ) : null}
        </div>
      )}

      <section className="portfolio-connected-content" aria-labelledby="portfolio-connected-title">
        <div>
          <span className="portfolio-section-kicker">Beyond the résumé</span>
          <h2 id="portfolio-connected-title">결과뿐 아니라 해결 과정도 기록합니다.</h2>
          <p>업무 History에서는 개발 과정에서 마주친 문제, 선택한 해결 방법과 배운 점을 더 자세히 확인할 수 있습니다.</p>
        </div>
        <div className="button-row">
          <Link className="primary-link" to="/history">업무 History 보기</Link>
          <Link className="secondary-link" to="/react">React 학습 로드맵</Link>
        </div>
      </section>

      {isBlockPickerOpen ? (
        <div className="portfolio-block-picker" role="dialog" aria-modal="true" aria-label="포트폴리오 블록 선택">
          <div className="portfolio-block-picker-search">
            <span aria-hidden="true">/</span>
            <input
              ref={blockSearchInputReference}
              value={blockSearchText}
              placeholder="추가할 블록 검색"
              aria-label="추가할 블록 검색"
              onChange={(event) => setBlockSearchText(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") setBlockPickerOpen(false); }}
            />
            <button type="button" onClick={() => setBlockPickerOpen(false)}>닫기</button>
          </div>
          <p className="portfolio-block-picker-label">기본 블록</p>
          <div className="portfolio-block-picker-list">
            {filteredBlockGroups.map((group) => (
              <button type="button" className="portfolio-block-option" key={group.sectionType} onClick={() => selectBlockType(group.sectionType)}>
                <span className="portfolio-block-option-icon" aria-hidden="true">{blockIconMap[group.sectionType]}</span>
                <span><strong>{group.title}</strong><small>{group.description}</small></span>
              </button>
            ))}
            {filteredBlockGroups.length === 0 ? <p className="portfolio-block-picker-empty">일치하는 블록이 없습니다.</p> : null}
          </div>
        </div>
      ) : null}

      <PortfolioSectionEditor
        isOpen={isSectionEditorOpen}
        section={editingSection}
        initialSectionType={initialSectionType}
        nextSortOrder={nextSortOrder}
        isSaving={createMutation.isPending || updateMutation.isPending || isReordering}
        onSave={saveSection}
        onClose={closeSectionEditor}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="포트폴리오 블록 삭제"
        description={`“${deleteTarget?.sectionTitle ?? ""}” 블록을 삭제할까요?`}
        confirmButtonLabel="삭제"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => void deleteSection()}
        onCancel={() => setDeleteTarget(undefined)}
      />
    </section>
  );
};
