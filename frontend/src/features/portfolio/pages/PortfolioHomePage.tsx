/**
 * PortfolioHomePage.tsx — 공개 포트폴리오 홈 (방문자: 읽기 / 슈퍼관리자: 블록 편집)
 *
 * [편집 기능]
 *   블록 추가 : 블록 사이의 + 버튼 또는 / 키 → 블록 종류 고르기 → 편집 대화상자
 *   순서 변경 : ↑↓ 버튼 또는 핸들(⠿) 드래그. 바뀐 블록들의 sortOrder(10, 20, 30 …)를 서버에 저장한다.
 *   공개 전환·복제·삭제: 각 카드의 관리 도구
 *
 * [서버 상태] 섹션 목록은 TanStack Query(usePortfolioSectionsQuery)가 관리한다.
 *   변경이 끝나면 목록 캐시를 무효화해 다시 받는다 → 화면은 항상 서버 값을 기준으로 그린다.
 * 편집 대화상자는 lazy로 필요할 때만 내려받아, 방문자는 에디터 코드를 받지 않는다(첫 화면이 가벼워진다).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { updatePortfolioSection } from "@/features/portfolio/api/portfolioApi";
import { PortfolioSectionCard } from "@/features/portfolio/components/PortfolioSectionCard";
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
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";

// 블록 선택 목록에 보여 줄 종류별 아이콘 글자.
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

// usePortfolioQueries.ts와 같은 캐시 키. 순서 변경 뒤 목록을 직접 무효화할 때 쓴다.
const portfolioQueryKey = ["portfolio", "sections"] as const;

// lazy: 처음 그려질 때 그 파일을 따로 내려받는다. 이름 있는 내보내기(named export)라 { default: … } 모양으로 감싸 준다.
const PortfolioSectionEditor = lazy(async () => ({
  default: (await import("@/features/portfolio/components/PortfolioSectionEditor")).PortfolioSectionEditor,
}));

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

  // 화면 전용 상태(UI State): 대화상자 열림, 편집 중인 섹션, 삭제 확인 대상, 블록 선택창, 드래그 중인 블록 등.
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

  // 슈퍼관리자로 로그인했을 때만 편집 도구를 보여 준다(실제 권한 검사는 서버가 다시 한다).
  const isEditMode = authSessionQuery.data?.superAdministrator === true;
  // sortOrder 순으로 정렬한 목록. 서버 데이터가 바뀔 때만 다시 정렬한다.
  const sections = useMemo(() => sortPortfolioBlocks(
    sectionsQuery.data ?? [],
  ), [sectionsQuery.data]);
  // 새 블록의 기본 순서 = 마지막 블록 + 10. 10씩 띄워 두면 사이에 끼워 넣기 쉽다. at(-1) = 배열의 마지막 요소.
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

  // 편집 모드에서 / 키를 누르면 블록 선택창을 연다(Notion 같은 단축키).
  // 입력칸·에디터에서 /를 칠 때는 글자 입력이어야 하므로 무시한다. 정리 함수로 리스너를 반드시 지운다.
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

  /**
   * 화면에 보이는 순서대로 sortOrder를 10, 20, 30 …으로 다시 매기고, 값이 바뀐 블록만 서버에 저장한다.
   * Promise.all: 여러 저장 요청을 동시에 보내고 모두 끝날 때까지 기다린다.
   */
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
        // 새 블록은 일단 맨 뒤에 만들고, 사용자가 고른 위치(pendingInsertIndex)로 옮겨 순서를 다시 저장한다.
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

  // 공개 ↔ 비공개 전환. 처리 중인 카드만 스위치를 잠그기 위해 어떤 블록이 처리 중인지 기억한다.
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

  // 복제: 같은 내용으로 새 블록을 만든다. versionNumber를 지워야 "수정"이 아니라 "새로 만들기" 요청이 된다.
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

  /** 블록 하나를 targetIndex 위치로 옮긴다. 저장에 실패하면 서버 목록을 다시 받아 화면을 원래대로 돌린다. */
  const moveSection = async (sourceId: number, targetIndex: number): Promise<void> => {
    const sourceIndex = sections.findIndex((section) => section.portfolioSectionId === sourceId);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= sections.length || sourceIndex === targetIndex || isReordering) return;
    const reorderedSections = [...sections];
    // splice(위치, 1): 그 자리의 요소 하나를 빼서 배열로 돌려준다. 복사본(reorderedSections)에서만 바꾸므로 원본은 그대로다.
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
          <div className="page-title-with-guide"><h1>포트폴리오</h1><FeatureHelpButton topic="portfolio" /></div>
        </div>
        <div className="portfolio-heading-actions">
          {isEditMode ? (
            <div className="portfolio-owner-toolbar">
              <span className="portfolio-edit-badge">슈퍼관리자 편집 가능</span>
              <span className="portfolio-owner-summary">{sections.length}개 블록</span>
              <button type="button" onClick={() => openBlockPicker()}>+ 블록 추가</button>
            </div>
          ) : null}
          {/* 브라우저 인쇄 창을 연다. 대상에서 "PDF로 저장"을 고르면 이력서처럼 내려받을 수 있다.
              인쇄용 모양(메뉴·버튼 숨김, 흰 배경)은 global.css의 @media print가 맡는다. */}
          <button type="button" className="ghost-button portfolio-print-button" onClick={() => window.print()}>PDF로 저장</button>
        </div>
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
                // HTML 드래그 앤 드롭: dragover에서 preventDefault를 해야 drop이 허용된다.
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
                      // span이지만 role="button"·tabIndex로 키보드 포커스를 받게 한다. 키보드 사용자는 옆의 ↑↓ 버튼으로 순서를 바꾼다.
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

      {/* 블록 선택창. 열릴 때 검색칸에 포커스가 가고(위 Effect), Esc로 닫는다. */}
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

      {/* 편집기는 열 때만 그린다. 파일을 내려받는 동안 Suspense가 "불러오는 중"을 보여 준다. */}
      {isSectionEditorOpen ? <Suspense fallback={<div role="status">편집기를 불러오는 중입니다.</div>}><PortfolioSectionEditor
        isOpen={isSectionEditorOpen}
        section={editingSection}
        initialSectionType={initialSectionType}
        nextSortOrder={nextSortOrder}
        isSaving={createMutation.isPending || updateMutation.isPending || isReordering}
        onSave={saveSection}
        onClose={closeSectionEditor}
      /></Suspense> : null}

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
