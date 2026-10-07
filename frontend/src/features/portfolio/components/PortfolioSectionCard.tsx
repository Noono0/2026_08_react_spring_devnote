/**
 * PortfolioSectionCard.tsx — 포트폴리오 홈의 섹션 카드 하나
 *
 * 방문자에게는 내용만, 편집 권한(editable)이 있으면 위쪽에 관리 도구(공개 스위치·수정·복제·삭제)를 함께 보여 준다.
 * 버튼을 눌렀을 때의 실제 동작(API 호출)은 부모(PortfolioHomePage)가 넘겨준 콜백이 맡는다.
 * → 카드는 "어떻게 보일지"만, 부모는 "무엇을 할지"만 책임진다.
 */
import { Link } from "react-router-dom";
import type { PortfolioSection } from "@/features/portfolio/types/portfolioTypes";
import { PortfolioProjectExternalLinks, PortfolioTechStackList } from "@/features/portfolio/components/PortfolioProjectParts";
import {
  createSummaryText,
  formatPortfolioPeriod,
  portfolioProjectPath,
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

// 섹션 종류별 외부 링크 문구. Partial<Record<…>>: 모든 종류를 다 적지 않아도 되는 표(없으면 기본 문구).
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
  // ★ 에디터 HTML을 화면에 넣기 전에 위험한 태그·속성(script, onerror 등)을 지운다(XSS 방지).
  const sanitizedContent = section.contentMode !== "STRUCTURED" && section.contentHtml
    ? sanitizeRichTextHtml(section.contentHtml)
    : "";
  const externalLinkLabel = externalLinkLabelMap[section.sectionType] ?? "관련 링크 열기";
  const isProject = section.sectionType === "PROJECT";

  return (
    <article
      className={`portfolio-entry portfolio-entry-${section.sectionType === "IMAGE" ? "image-block" : section.sectionType.toLowerCase()}${section.visibility === "HIDDEN" ? " portfolio-entry-hidden" : ""}`}
    >
      {/* 편집 권한이 있을 때만 관리 도구를 보여 준다(권한의 최종 확인은 서버가 한다). */}
      {editable ? (
        <div className="portfolio-entry-admin" aria-label={`${section.sectionTitle} 관리`}>
          <div className="portfolio-visibility-control">
            <span>공개 설정</span>
            <button
              type="button"
              // role="switch" + aria-checked: 화면 낭독기가 "켜짐/꺼짐 스위치"로 읽는다. 처리 중에는 두 번 누르지 못하게 비활성화.
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
        {isProject ? (
          // 프로젝트는 홈에서 요약만 보여 주고, 전체 설명은 상세 화면에서 읽는다.
          <>
            {section.roleSummary ? <p className="portfolio-project-role"><strong>역할</strong> {section.roleSummary}</p> : null}
            <PortfolioTechStackList techStack={section.techStack} />
            {section.contentText.trim() ? <p className="portfolio-project-summary">{createSummaryText(section.contentText)}</p> : null}
            <div className="button-row portfolio-project-links">
              <Link className="primary-link" to={portfolioProjectPath(section.portfolioSectionId)}>자세히 보기</Link>
              <PortfolioProjectExternalLinks section={section} />
            </div>
          </>
        ) : (
          <>
            {/* dangerouslySetInnerHTML: 문자열을 HTML로 그대로 넣는다. 반드시 위에서 정화한(sanitized) 값만 넣는다. */}
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
          </>
        )}
      </div>
    </article>
  );
};
