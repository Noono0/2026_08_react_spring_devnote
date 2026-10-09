/**
 * OnlinePracticeMenu.tsx — 학습 화면 제목 옆의 "직접 해 보기" 메뉴
 *
 * 설치 없이 이 단계를 연습하는 방법을 고르게 한다.
 *   - 이 화면에서 바로 편집(Sandpack) : 사이트를 떠나지 않고 단계별 연습 예제를 고쳐 실행
 *   - StackBlitz                       : 실제 프로젝트 frontend 전체를 새 탭에서 실행(더미 데이터)
 *   - Codespaces                       : 백엔드·MySQL까지 전체 실행 — [CODESPACES] 표시, 아래 SHOW_CODESPACES_OPTION으로 끌 수 있음
 * 주소는 data/onlinePracticeLinks.ts가 만든다.
 *
 * <details>/<summary>: 브라우저 기본 펼침 메뉴. State 없이 열고 닫히고, 키보드(Enter·Space)로도 열린다.
 * 새 탭 링크에는 rel="noopener noreferrer"를 붙여, 열린 사이트가 이 페이지(window.opener)를 조작하지 못하게 한다.
 */
import { lazy, Suspense, useState } from "react";
import type { LearningGuide } from "@/features/curriculum/data/learningGuides";
import { createCodespacesUrl, createStackBlitzUrl, findPracticeSourceFile, SHOW_CODESPACES_OPTION } from "@/features/curriculum/data/onlinePracticeLinks";

// 편집기(Sandpack)는 크므로 버튼을 눌렀을 때만 내려받는다.
const StageSandboxDialog = lazy(() => import("@/features/curriculum/components/StageSandboxDialog"));

interface OnlinePracticeMenuProperties {
  learningGuide: LearningGuide;
}

export const OnlinePracticeMenu = ({ learningGuide }: OnlinePracticeMenuProperties) => {
  const sourceFile = findPracticeSourceFile(learningGuide);
  const [isEditorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <details className="online-practice-menu">
        <summary aria-label={`${learningGuide.title} 직접 해 보기`}>▶ 직접 해 보기</summary>
        <div className="online-practice-panel">
          <p className="online-practice-intro">설치 없이 코드를 고쳐 보며 연습합니다. 고친 내용은 실제 사이트와 저장소에 반영되지 않습니다.</p>

          <button type="button" className="online-practice-option" onClick={() => setEditorOpen(true)}>
            <strong>이 화면에서 바로 편집</strong>
            <span>사이트 안 편집기(Sandpack) · 이 단계 핵심만 담은 연습 예제 · 고치면 바로 실행</span>
          </button>

          <a className="online-practice-option" href={createStackBlitzUrl(learningGuide)} target="_blank" rel="noopener noreferrer">
            <strong>StackBlitz에서 실제 코드 열기 <span aria-hidden="true">↗</span></strong>
            <span>실제 프로젝트 frontend 전체 · 로그인 불필요 · 더미 데이터 · 첫 실행은 설치에 1분 정도</span>
          </a>

          {/* [CODESPACES] 시작 — 제거하려면 이 블록과 onlinePracticeLinks.ts의 [CODESPACES] 부분을 지운다(docs/learning-guide.md 참고) */}
          {SHOW_CODESPACES_OPTION ? (
            <a className="online-practice-option" href={createCodespacesUrl()} target="_blank" rel="noopener noreferrer">
              <strong>Codespaces에서 전체 실행 <span aria-hidden="true">↗</span></strong>
              <span>GitHub 로그인 필요 · Spring Boot·MySQL까지 실제 API · 첫 생성은 몇 분 걸림</span>
              <span>열린 뒤 터미널에서 <code>bash scripts/start-codespace.sh</code>를 실행하세요.</span>
            </a>
          ) : null}
          {/* [CODESPACES] 끝 */}

          {sourceFile ? <p className="online-practice-file">실제 단계 파일: <code>frontend/{sourceFile}</code></p> : null}
        </div>
      </details>

      {/* 편집기를 한 번이라도 열었을 때만 그린다(그 전에는 Sandpack을 내려받지 않는다). */}
      {isEditorOpen ? (
        <Suspense fallback={<p className="online-practice-loading" role="status">편집기를 불러오는 중입니다…</p>}>
          <StageSandboxDialog learningGuide={learningGuide} isOpen={isEditorOpen} onRequestClose={() => setEditorOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
};
