/**
 * 프로젝트 상세 화면 (/projects/:sectionId)
 *
 * 홈의 프로젝트 카드는 요약만 보여 주고, 이 화면에서 기간·역할·기술 스택·링크와 전체 설명을 보여 준다.
 * 별도 상세 API를 만들지 않고 홈과 같은 섹션 목록 Query를 쓴다. (같은 캐시를 써서 홈↔상세 이동이 즉시 표시된다)
 * 서버는 비공개 섹션을 슈퍼관리자에게만 내려주므로, 목록에 없으면 공개되지 않은 프로젝트로 보고 안내한다.
 */

import { Link, useParams } from "react-router-dom";
import { usePortfolioSectionsQuery } from "@/features/portfolio/hooks/usePortfolioQueries";
import { PortfolioProjectExternalLinks, PortfolioTechStackList } from "@/features/portfolio/components/PortfolioProjectParts";
import { formatPortfolioPeriod } from "@/features/portfolio/utils/portfolioSectionPresentation";
import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";

/** 주소의 값은 사용자가 바꿀 수 있으므로 양의 정수일 때만 받아들인다. */
const parseSectionId = (rawSectionId: string | undefined): number | undefined => {
  if (!rawSectionId || !/^[1-9]\d*$/.test(rawSectionId)) return undefined;
  const sectionId = Number(rawSectionId);
  return Number.isSafeInteger(sectionId) ? sectionId : undefined;
};

export const PortfolioProjectDetailPage = () => {
  // useParams(): 라우트 주소 /projects/:sectionId의 :sectionId 부분을 문자열로 꺼낸다.
  const sectionId = parseSectionId(useParams().sectionId);
  const sectionsQuery = usePortfolioSectionsQuery();

  if (sectionsQuery.isPending) return <div className="portfolio-state-panel" role="status">프로젝트를 불러오는 중입니다.</div>;
  if (sectionsQuery.isError) {
    return (
      <div className="portfolio-state-panel error-state" role="alert">
        <p>프로젝트를 불러오지 못했습니다.</p>
        <button type="button" onClick={() => void sectionsQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  // 번호가 같고 종류가 PROJECT인 섹션만 상세 화면으로 보여 준다(다른 종류의 번호를 넣어도 "찾을 수 없음").
  const project = sectionsQuery.data.find((section) => section.portfolioSectionId === sectionId && section.sectionType === "PROJECT");
  if (!project) {
    return (
      <div className="portfolio-state-panel" role="alert">
        <p>프로젝트를 찾을 수 없습니다. 주소가 잘못되었거나 공개되지 않은 프로젝트입니다.</p>
        <Link className="primary-link" to="/">포트폴리오로 돌아가기</Link>
      </div>
    );
  }

  const period = formatPortfolioPeriod(project);
  // 에디터 HTML은 화면에 넣기 전에 반드시 정화한다(XSS 방지).
  const contentHtml = project.contentHtml ? sanitizeRichTextHtml(project.contentHtml) : "";

  return (
    <article className="portfolio-page portfolio-project-detail">
      <nav aria-label="이동 경로"><Link to="/">← 포트폴리오</Link></nav>
      <header className="portfolio-project-heading">
        <span className="portfolio-section-kicker">Project</span>
        <div className="page-title-with-guide"><h1>{project.sectionTitle}</h1><FeatureHelpButton topic="project" /></div>
        {project.sectionSubtitle ? <p>{project.sectionSubtitle}</p> : null}
      </header>

      <dl className="portfolio-project-facts">
        {/* <dl> 정의 목록: dt(이름)·dd(값) 짝으로 프로젝트 정보를 나열한다. 값이 있는 항목만 그린다. */}
        {period ? <><dt>기간</dt><dd>{period}{project.current ? " · 진행 중" : ""}</dd></> : null}
        {project.roleSummary ? <><dt>역할</dt><dd>{project.roleSummary}</dd></> : null}
        {project.techStack.length > 0 ? <><dt>기술</dt><dd><PortfolioTechStackList techStack={project.techStack} /></dd></> : null}
      </dl>
      <div className="button-row portfolio-project-links"><PortfolioProjectExternalLinks section={project} /></div>

      {project.thumbnailImageUrl ? (
        <figure className="portfolio-entry-image"><img src={project.thumbnailImageUrl} alt={`${project.sectionTitle} 대표 이미지`} /></figure>
      ) : null}
      {contentHtml
        ? <div className="portfolio-rich-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        : <p className="portfolio-empty-state">아직 상세 설명이 없습니다.</p>}
    </article>
  );
};
