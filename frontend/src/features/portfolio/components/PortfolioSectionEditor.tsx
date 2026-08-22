import { useEffect, useState, type FormEvent } from "react";
import type { JSONContent } from "@tiptap/core";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { RichTextEditor } from "@/features/document/components/RichTextEditor";
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

const emptyEditorValue: EditorValue = {
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>",
  contentText: "",
};

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
  }, [initialSectionType, isOpen, nextSortOrder, section]);

  const showStructuredFields = contentMode !== "RICH_TEXT";
  const showEditor = contentMode !== "STRUCTURED";
  const showPeriod = showStructuredFields && periodSectionTypes.has(sectionType);
  const showExternalLink = showStructuredFields && externalLinkSectionTypes.has(sectionType);
  const showThumbnail = showStructuredFields && sectionType !== "SKILL" && sectionType !== "CONTACT";

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
      ...(showEditor ? editorValue : emptyEditorValue),
      layoutType: section?.layoutType ?? "DEFAULT",
      sortOrder,
      visibility,
      editorImageFileIds: showEditor ? collectEditorImageFileIds(editorValue.contentJson) : [],
      versionNumber: section?.versionNumber,
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
      closeOnBackdropClick={!isSaving}
    >
      <form className="portfolio-section-form" onSubmit={(event) => void submitSection(event)}>
        <div className="portfolio-form-grid">
          <label>
            섹션 종류
            <select
              value={sectionType}
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
                <input type="checkbox" checked={current} onChange={(event) => { setCurrent(event.target.checked); if (event.target.checked) setEndDate(""); }} />
                현재 진행 중
              </label>
            </>
          ) : null}
          {showExternalLink ? (
            <label className="portfolio-wide-field">외부 링크<input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://github.com/..." /></label>
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
