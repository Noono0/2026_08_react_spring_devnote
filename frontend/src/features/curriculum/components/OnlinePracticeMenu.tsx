/**
 * OnlinePracticeMenu.tsx — 학습 화면 제목 옆의 "온라인에서 실습" 메뉴
 *
 * 설치 없이 이 단계의 소스를 고쳐 볼 수 있는 두 가지 방법을 고르게 한다.
 *   - StackBlitz : 빠름·로그인 불필요, 프론트엔드만(더미 데이터)
 *   - Codespaces : 백엔드·MySQL까지 전체 실행, GitHub 로그인 필요
 * 주소는 data/onlinePracticeLinks.ts가 만든다.
 *
 * <details>/<summary>: 브라우저 기본 펼침 메뉴. State 없이 열고 닫히고, 키보드(Enter·Space)로도 열린다.
 * 새 탭 링크에는 rel="noopener noreferrer"를 붙여, 열린 사이트가 이 페이지(window.opener)를 조작하지 못하게 한다.
 */
import type { LearningGuide } from "@/features/curriculum/data/learningGuides";
import { createCodespacesUrl, createStackBlitzUrl, findPracticeSourceFile } from "@/features/curriculum/data/onlinePracticeLinks";

interface OnlinePracticeMenuProperties {
  learningGuide: LearningGuide;
}

export const OnlinePracticeMenu = ({ learningGuide }: OnlinePracticeMenuProperties) => {
  const sourceFile = findPracticeSourceFile(learningGuide);

  return (
    <details className="online-practice-menu">
      <summary aria-label={`${learningGuide.title} 온라인에서 실습하기`}>▶ 온라인에서 실습</summary>
      <div className="online-practice-panel">
        <p className="online-practice-intro">설치 없이 이 단계의 소스를 고쳐 보며 연습합니다. GitHub의 main 브랜치 코드가 열리고, 고친 내용은 원래 저장소에 반영되지 않습니다.</p>

        <a className="online-practice-option" href={createStackBlitzUrl(learningGuide)} target="_blank" rel="noopener noreferrer">
          <strong>StackBlitz에서 바로 열기 <span aria-hidden="true">↗</span></strong>
          <span>로그인 없이 빠르게 시작 · 프론트엔드만 실행(더미 데이터) · 첫 실행은 설치에 1분 정도 걸림</span>
        </a>

        <a className="online-practice-option" href={createCodespacesUrl()} target="_blank" rel="noopener noreferrer">
          <strong>Codespaces에서 전체 실행 <span aria-hidden="true">↗</span></strong>
          <span>GitHub 로그인 필요 · Spring Boot·MySQL까지 실제 API로 실행 · 첫 생성은 몇 분 걸림</span>
          <span>열린 뒤 터미널에서 <code>bash scripts/start-codespace.sh</code>를 실행하세요.</span>
        </a>

        {sourceFile ? (
          <p className="online-practice-file">이 단계 파일: <code>frontend/{sourceFile}</code></p>
        ) : null}
      </div>
    </details>
  );
};
