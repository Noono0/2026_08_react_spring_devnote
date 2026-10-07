/**
 * PortfolioSectionEditor.tsx — 포트폴리오 섹션 추가·수정 대화상자
 *
 * [섹션 종류 × 작성 방식에 따라 보이는 칸이 달라진다]
 *   STRUCTURED(정해진 양식) : 제목·부제목·기간·링크·이미지 같은 정해진 칸
 *   RICH_TEXT(자유 편집)    : 에디터 본문만
 *   HYBRID(양식 + 자유 편집): 둘 다
 *   기간은 경력·프로젝트·교육·자격에서만, 기술 스택·역할·저장소/데모 주소는 프로젝트에서만 보인다.
 *
 * [저장 흐름] 화면에서 간단히 검사 → onSave(부모)가 API 호출 → 서버가 최종 검사(날짜 순서, http(s) 링크, 이미지 소유자).
 * 숨겨진 칸의 값은 보내지 않는다(undefined). 그래서 종류를 바꿔도 이전 종류의 값이 섞여 저장되지 않는다.
 */
import { useEffect, useState, type FormEvent } from "react";
import type { JSONContent } from "@tiptap/core";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { RichTextEditor } from "@/features/rich-text-editor/components/RichTextEditor";
import { ThumbnailImageUploader } from "@/features/file/components/ThumbnailImageUploader";
import { uploadPortfolioEditorImage } from "@/features/portfolio/api/portfolioApi";
import type {
  PortfolioContentMode,
  PortfolioSection,
  PortfolioSectionSaveRequest,
  PortfolioSectionType,
  PortfolioVisibility,
} from "@/features/portfolio/types/portfolioTypes";
import { collectEditorImageFileIds } from "@/features/portfolio/utils/portfolioEditorContent";
import { parseTechStackText } from "@/features/portfolio/utils/portfolioSectionPresentation";

interface PortfolioSectionEditorProperties {
  isOpen: boolean;
  section?: PortfolioSection;
  initialSectionType?: PortfolioSectionType;
  nextSortOrder: number;
  isSaving: boolean;
  onSave: (request: PortfolioSectionSaveRequest) => Promise<void>;
  onClose: () => void;
}

interface EditorValue {
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
}

// 새 섹션의 빈 에디터 본문(Tiptap 문서 구조: 빈 문단 하나).
const emptyEditorValue: EditorValue = {
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>",
  contentText: "",
};

// 아래 표들(Record<종류, 값>)은 섹션 종류마다 다른 이름·기본값을 정한다. 새 종류를 추가하면 TypeScript가 빠진 표를 알려 준다.
const typeLabelMap: Record<PortfolioSectionType, string> = {
  PROFILE: "소개",
  RICH_TEXT: "자유 글",
  IMAGE: "이미지",
  SKILL: "기술",
  EXPERIENCE: "경력",
  PROJECT: "프로젝트",
  EDUCATION: "교육",
  CERTIFICATE: "자격·인증",
  CONTACT: "연락처",
};

// 종류를 고르면 자동으로 선택되는 추천 작성 방식.
const recommendedModeMap: Record<PortfolioSectionType, PortfolioContentMode> = {
  PROFILE: "HYBRID",
  RICH_TEXT: "RICH_TEXT",
  IMAGE: "STRUCTURED",
  SKILL: "STRUCTURED",
  EXPERIENCE: "HYBRID",
  PROJECT: "HYBRID",
  EDUCATION: "HYBRID",
  CERTIFICATE: "HYBRID",
  CONTACT: "HYBRID",
};

const titleLabelMap: Record<PortfolioSectionType, string> = {
  PROFILE: "대표 문구",
  RICH_TEXT: "글 제목",
  IMAGE: "이미지 제목",
  SKILL: "기술명",
  EXPERIENCE: "회사명",
  PROJECT: "프로젝트명",
  EDUCATION: "학교·교육기관",
  CERTIFICATE: "자격·인증명",
  CONTACT: "연락 채널",
};

const subtitleLabelMap: Record<PortfolioSectionType, string> = {
  PROFILE: "직무·기술 요약",
  RICH_TEXT: "짧은 설명",
  IMAGE: "이미지 설명",
  SKILL: "기술 분류",
  EXPERIENCE: "직무·직책",
  PROJECT: "한 줄 소개",
  EDUCATION: "전공·교육 과정",
  CERTIFICATE: "발급 기관",
  CONTACT: "주소·계정명",
};

// 기간 칸을 보여 줄 종류 / 외부 링크 칸을 보여 줄 종류. Set.has로 빠르게 확인한다.
const periodSectionTypes = new Set<PortfolioSectionType>([
  "EXPERIENCE",
  "PROJECT",
  "EDUCATION",
  "CERTIFICATE",
]);

const externalLinkSectionTypes = new Set<PortfolioSectionType>([
  "PROFILE",
  "PROJECT",
  "CERTIFICATE",
  "CONTACT",
]);

export const PortfolioSectionEditor = ({
  isOpen,
  section,
  initialSectionType = "RICH_TEXT",
  nextSortOrder,
  isSaving,
  onSave,
  onClose,
}: PortfolioSectionEditorProperties) => {
  // 입력칸마다 State 하나. 대화상자가 열릴 때 아래 Effect가 "수정할 섹션 값" 또는 "빈 값"으로 한꺼번에 채운다.
  const [sectionType, setSectionType] = useState<PortfolioSectionType>("RICH_TEXT");
  const [contentMode, setContentMode] = useState<PortfolioContentMode>("RICH_TEXT");
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionSubtitle, setSectionSubtitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [current, setCurrent] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [thumbnailFileId, setThumbnailFileId] = useState<number>();
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState<string>();
  const [visibility, setVisibility] = useState<PortfolioVisibility>("PUBLIC");
  const [sortOrder, setSortOrder] = useState(nextSortOrder);
  const [editorValue, setEditorValue] = useState<EditorValue>(emptyEditorValue);
  const [validationMessage, setValidationMessage] = useState("");
  // PROJECT 전용 값. 기술 스택은 "React, Spring Boot"처럼 쉼표로 구분해 입력받는다.
  const [techStackText, setTechStackText] = useState("");
  const [roleSummary, setRoleSummary] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");

  // 대화상자를 열 때마다(또는 다른 섹션을 열면) 입력칸을 다시 채운다. 닫혀 있을 때는 아무것도 하지 않는다.
  useEffect(() => {
    if (!isOpen) return;
    const nextSectionType = section?.sectionType ?? initialSectionType;
    setSectionType(nextSectionType);
    setContentMode(section?.contentMode ?? recommendedModeMap[nextSectionType]);
    setSectionTitle(section?.sectionTitle ?? "");
    setSectionSubtitle(section?.sectionSubtitle ?? "");
    setStartDate(section?.startDate ?? "");
    setEndDate(section?.endDate ?? "");
    setCurrent(section?.current ?? false);
    setExternalUrl(section?.externalUrl ?? "");
    setThumbnailFileId(section?.thumbnailFileId);
    setThumbnailImageUrl(section?.thumbnailImageUrl);
    setVisibility(section?.visibility ?? "PUBLIC");
    setSortOrder(section?.sortOrder ?? nextSortOrder);
    setEditorValue(section ? {
      contentJson: section.contentJson,
      contentHtml: section.contentHtml,
      contentText: section.contentText,
    } : emptyEditorValue);
    setValidationMessage("");
    setTechStackText(section?.techStack.join(", ") ?? "");
    setRoleSummary(section?.roleSummary ?? "");
    setRepositoryUrl(section?.repositoryUrl ?? "");
    setDemoUrl(section?.demoUrl ?? "");
  }, [initialSectionType, isOpen, nextSortOrder, section]);

  // 지금 보여 줄 칸들. State로 따로 두지 않고 종류·작성 방식에서 계산한다(같은 정보를 두 곳에 두지 않기).
  const showStructuredFields = contentMode !== "RICH_TEXT";
  const showEditor = contentMode !== "STRUCTURED";
  const showPeriod = showStructuredFields && periodSectionTypes.has(sectionType);
  const showExternalLink = showStructuredFields && externalLinkSectionTypes.has(sectionType);
  const showThumbnail = showStructuredFields && sectionType !== "SKILL" && sectionType !== "CONTACT";
  const showProjectDetails = showStructuredFields && sectionType === "PROJECT";

  /** 화면에서 확인할 수 있는 규칙(제목 필수, 이미지 블록은 이미지 필수, 날짜 순서)을 먼저 검사한 뒤 저장한다. */
  const submitSection = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!sectionTitle.trim()) {
      setValidationMessage(`${titleLabelMap[sectionType]}을 입력해 주세요.`);
      return;
    }
    if (sectionType === "IMAGE" && !thumbnailFileId) {
      setValidationMessage("표시할 이미지를 선택하거나 붙여넣어 주세요.");
      return;
    }
    // "2026-10-05" 같은 날짜 문자열은 글자 순서가 곧 날짜 순서라 문자열 비교로 앞뒤를 알 수 있다.
    if (showPeriod && startDate && endDate && endDate < startDate) {
      setValidationMessage("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    setValidationMessage("");
    await onSave({
      sectionType,
      contentMode,
      sectionTitle: sectionTitle.trim(),
      sectionSubtitle: sectionSubtitle.trim() || undefined,
      startDate: showPeriod && startDate ? startDate : undefined,
      endDate: showPeriod && !current && endDate ? endDate : undefined,
      current: showPeriod && current,
      externalUrl: showExternalLink && externalUrl.trim() ? externalUrl.trim() : undefined,
      thumbnailFileId: showThumbnail ? thumbnailFileId : undefined,
      // 에디터를 쓰지 않는 방식이면 빈 본문을 보낸다(서버는 contentJson·contentHtml·contentText를 필수로 받는다).
      ...(showEditor ? editorValue : emptyEditorValue),
      layoutType: section?.layoutType ?? "DEFAULT",
      sortOrder,
      visibility,
      // 본문 JSON에서 이미지 파일 번호를 모아 보낸다. 서버가 이 파일들을 섹션과 연결하고 ACTIVE로 바꾼다.
      editorImageFileIds: showEditor ? collectEditorImageFileIds(editorValue.contentJson) : [],
      versionNumber: section?.versionNumber,
      techStack: showProjectDetails ? parseTechStackText(techStackText) : [],
      roleSummary: showProjectDetails && roleSummary.trim() ? roleSummary.trim() : undefined,
      repositoryUrl: showProjectDetails && repositoryUrl.trim() ? repositoryUrl.trim() : undefined,
      demoUrl: showProjectDetails && demoUrl.trim() ? demoUrl.trim() : undefined,
    });
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      size="large"
      resizable
      resizeStorageKey="portfolio-section-editor"
      title={section ? `${typeLabelMap[section.sectionType]} 수정` : "포트폴리오 섹션 추가"}
      description="블록 종류를 고르고 내용을 작성하세요. 저장한 블록은 화면에서 자유롭게 정렬할 수 있습니다."
      onRequestClose={onClose}
      // 저장 중에는 바깥을 눌러도 닫히지 않게 한다(요청 도중 화면이 사라지는 것 방지).
      closeOnBackdropClick={!isSaving}
    >
      <form className="portfolio-section-form" onSubmit={(event) => void submitSection(event)}>
        <div className="portfolio-form-grid">
          <label>
            섹션 종류
            <select
              value={sectionType}
              // 이미 저장된 섹션은 종류를 바꾸지 못한다(종류에 따라 저장되는 값이 달라지기 때문).
              disabled={Boolean(section)}
              onChange={(event) => {
                const nextType = event.target.value as PortfolioSectionType;
                setSectionType(nextType);
                setContentMode(recommendedModeMap[nextType]);
              }}
            >
              {(Object.keys(typeLabelMap) as PortfolioSectionType[])
                .map((type) => <option key={type} value={type}>{typeLabelMap[type]}</option>)}
            </select>
          </label>
          <label>
            작성 방식
            <select disabled={sectionType === "IMAGE"} value={contentMode} onChange={(event) => setContentMode(event.target.value as PortfolioContentMode)}>
              <option value="STRUCTURED">정해진 양식</option>
              <option value="RICH_TEXT">자유 편집</option>
              <option value="HYBRID">양식 + 자유 편집</option>
            </select>
          </label>
          <label>
            {titleLabelMap[sectionType]}
            <input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} maxLength={120} />
          </label>
          {showStructuredFields ? (
            <label>
              {subtitleLabelMap[sectionType]}
              <input value={sectionSubtitle} onChange={(event) => setSectionSubtitle(event.target.value)} maxLength={200} />
            </label>
          ) : null}
          {showPeriod ? (
            <>
              <label>시작일<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
              <label>종료일<input type="date" value={endDate} disabled={current} onChange={(event) => setEndDate(event.target.value)} /></label>
              <label className="checkbox-label portfolio-current-field">
                {/* 진행 중이면 종료일을 비우고 입력칸을 잠근다(서버도 "진행 중 + 종료일"을 거부한다). */}
                <input type="checkbox" checked={current} onChange={(event) => { setCurrent(event.target.checked); if (event.target.checked) setEndDate(""); }} />
                현재 진행 중
              </label>
            </>
          ) : null}
          {showExternalLink ? (
            <label className="portfolio-wide-field">외부 링크<input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://github.com/..." /></label>
          ) : null}
          {showProjectDetails ? (
            <>
              <label className="portfolio-wide-field">기술 스택 <small>쉼표로 구분 · 최대 15개</small><input value={techStackText} onChange={(event) => setTechStackText(event.target.value)} placeholder="React, TypeScript, Spring Boot" /></label>
              <label className="portfolio-wide-field">맡은 역할<input value={roleSummary} onChange={(event) => setRoleSummary(event.target.value)} maxLength={300} placeholder="예: 기획·프론트엔드·백엔드·배포 전체" /></label>
              <label>저장소 주소<input type="url" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://github.com/..." /></label>
              <label>데모 주소<input type="url" value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} placeholder="https://..." /></label>
            </>
          ) : null}
          <label>
            공개 상태
            <span className="portfolio-form-switch-row">
              <button
                type="button"
                role="switch"
                aria-checked={visibility === "PUBLIC"}
                className={`portfolio-visibility-toggle portfolio-visibility-toggle-${visibility === "PUBLIC" ? "on" : "off"}`}
                onClick={() => setVisibility((currentVisibility) => currentVisibility === "PUBLIC" ? "HIDDEN" : "PUBLIC")}
              >
                <span className="portfolio-visibility-track" aria-hidden="true"><span className="portfolio-visibility-thumb" /></span>
                <strong>{visibility === "PUBLIC" ? "ON" : "OFF"}</strong>
              </button>
              <span>{visibility === "PUBLIC" ? "방문자에게 공개" : "슈퍼관리자만 보기"}</span>
            </span>
          </label>
        </div>

        {showThumbnail ? (
          <ThumbnailImageUploader
            title={sectionType === "PROFILE" ? "프로필 이미지" : sectionType === "IMAGE" ? "이미지 블록" : "대표 이미지"}
            description={sectionType === "IMAGE"
              ? "파일을 선택하거나 클립보드 이미지를 붙여넣어 블록에 표시할 이미지를 올려 주세요."
              : "파일을 선택하면 미리 업로드되고, 블록을 저장할 때 연결됩니다."}
            thumbnailImageUrl={thumbnailImageUrl}
            imageUploadFunction={uploadPortfolioEditorImage}
            handleThumbnailChange={(fileId, imageUrl) => { setThumbnailFileId(fileId); setThumbnailImageUrl(imageUrl); }}
          />
        ) : null}

        {/* key가 바뀌면 React가 에디터를 새로 만든다. 다른 섹션·종류를 열 때 이전 본문이 남지 않게 하기 위해서다. */}
        {isOpen && showEditor ? (
          <RichTextEditor
            key={`${section?.portfolioSectionId ?? "new"}-${sectionType}`}
            editorLabel="상세 설명"
            initialContent={editorValue.contentJson}
            imageUploadFunction={uploadPortfolioEditorImage}
            handleContentChange={setEditorValue}
          />
        ) : null}

        {validationMessage ? <p className="field-error" role="alert">{validationMessage}</p> : null}
        <div className="button-row portfolio-form-actions">
          <button type="submit" disabled={isSaving}>{isSaving ? "저장 중..." : section ? "수정 저장" : "블록 추가"}</button>
          <button type="button" className="ghost-button" onClick={onClose} disabled={isSaving}>취소</button>
        </div>
      </form>
    </ModalDialog>
  );
};
