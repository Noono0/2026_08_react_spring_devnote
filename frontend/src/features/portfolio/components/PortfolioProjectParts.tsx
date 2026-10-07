import type { PortfolioSection } from "@/features/portfolio/types/portfolioTypes";

/** 홈 카드와 상세 화면이 함께 쓰는 기술 스택 목록. */
export const PortfolioTechStackList = ({ techStack }: { techStack: string[] }) => (
  techStack.length > 0 ? (
    <ul className="topic-chip-list portfolio-tech-stack" aria-label="사용 기술">
      {techStack.map((techName) => <li key={techName}>{techName}</li>)}
    </ul>
  ) : null
);

/** 저장소·데모·기타 링크. 서버가 http(s) 주소만 저장하므로 그대로 링크로 연다. */
export const PortfolioProjectExternalLinks = ({ section }: { section: PortfolioSection }) => (
  <>
    {/* target="_blank" + rel="noreferrer": 새 탭으로 열되, 열린 페이지가 이 페이지(window.opener)를 조작하지 못하게 한다. */}
    {section.repositoryUrl ? <a className="secondary-link" href={section.repositoryUrl} target="_blank" rel="noreferrer">소스 코드 <span aria-hidden="true">↗</span></a> : null}
    {section.demoUrl ? <a className="secondary-link" href={section.demoUrl} target="_blank" rel="noreferrer">데모 <span aria-hidden="true">↗</span></a> : null}
    {section.externalUrl ? <a className="secondary-link" href={section.externalUrl} target="_blank" rel="noreferrer">프로젝트 링크 <span aria-hidden="true">↗</span></a> : null}
  </>
);
