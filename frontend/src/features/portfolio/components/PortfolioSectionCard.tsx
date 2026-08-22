import type { PortfolioSection } from "@/features/portfolio/types/portfolioTypes";
import {
  formatPortfolioPeriod,
  portfolioSectionTypeLabels,
} from "@/features/portfolio/utils/portfolioSectionPresentation";
import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";

interface PortfolioSectionCardProperties {
  section: PortfolioSection;
  editable: boolean;
  visibilityPending: boolean;
  onEdit: (section: PortfolioSection) => void;
  onDuplicate: (section: PortfolioSection) => void;
  onDelete: (section: PortfolioSection) => void;
  onVisibilityToggle: (section: PortfolioSection) => void;
}

const externalLinkLabelMap: Partial<Record<PortfolioSection["sectionType"], string>> = {
  PROFILE: "프로필 링크 열기",
  PROJECT: "프로젝트 링크 열기",
  CERTIFICATE: "자격·인증 확인하기",
  CONTACT: "연락하기",
};

export const PortfolioSectionCard = ({
  section,
  editable,
  visibilityPending,
  onEdit,
  onDuplicate,
  onDelete,
  onVisibilityToggle,
}: PortfolioSectionCardProperties) => {
  const period = formatPortfolioPeriod(section);
  const sanitizedContent = section.contentMode !== "STRUCTURED" && section.contentHtml
    ? sanitizeRichTextHtml(section.contentHtml)
    : "";
  const externalLinkLabel = externalLinkLabelMap[section.sectionType] ?? "관련 링크 열기";

  return (
    <article
      className={`portfolio-entry portfolio-entry-${section.sectionType === "IMAGE" ? "image-block" : section.sectionType.toLowerCase()}${section.visibility === "HIDDEN" ? " portfolio-entry-hidden" : ""}`}
    >
      {editable ? (
        <div className="portfolio-entry-admin" aria-label={`${section.sectionTitle} 관리`}>
          <div className="portfolio-visibility-control">
            <span>공개 설정</span>
            <button
              type="button"
              role="switch"
              aria-checked={section.visibility === "PUBLIC"}
              aria-label={`${section.sectionTitle} 공개 설정`}
              className={`portfolio-visibility-toggle portfolio-visibility-toggle-${section.visibility === "PUBLIC" ? "on" : "off"}`}
              disabled={visibilityPending}
              onClick={() => onVisibilityToggle(section)}
            >
              <span className="portfolio-visibility-track" aria-hidden="true">
                <span className="portfolio-visibility-thumb" />
              </span>
              <strong>{visibilityPending ? "..." : section.visibility === "PUBLIC" ? "ON" : "OFF"}</strong>
            </button>
          </div>
          <div className="button-row compact-button-row">
            <button type="button" className="secondary-button" onClick={() => onEdit(section)}>수정</button>
            <button type="button" className="ghost-button" onClick={() => onDuplicate(section)}>복제</button>
            <button type="button" className="danger-button" onClick={() => onDelete(section)}>삭제</button>
          </div>
        </div>
      ) : null}

      {period ? (
        <div className="portfolio-entry-period">
          <span>{period}</span>
          {section.current ? <strong>진행 중</strong> : null}
        </div>
      ) : null}

      {section.thumbnailImageUrl ? (
        <div className="portfolio-entry-image">
          <img src={section.thumbnailImageUrl} alt={`${section.sectionTitle} 대표 이미지`} />
        </div>
      ) : null}

      <div className="portfolio-entry-copy">
        <span className="portfolio-entry-type">{portfolioSectionTypeLabels[section.sectionType]}</span>
        <h3>{section.sectionTitle}</h3>
        {section.sectionSubtitle ? <p className="portfolio-entry-subtitle">{section.sectionSubtitle}</p> : null}
        {sanitizedContent ? (
          <div
            className="portfolio-rich-content"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        ) : null}
        {section.externalUrl ? (
          <a className="secondary-link portfolio-entry-link" href={section.externalUrl} target="_blank" rel="noreferrer">
            {externalLinkLabel} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
};
