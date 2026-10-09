/**
 * ============================================================================
 * onlinePracticeLinks.ts — 학습 단계를 "설치 없이 온라인에서" 여는 주소 만들기
 * ============================================================================
 *
 * 학습 화면의 "온라인에서 실습" 메뉴가 이 함수들로 두 가지 주소를 만든다.
 *
 *   StackBlitz : 브라우저 안에서 Node를 돌려 frontend 폴더만 실행한다. 빠르고 로그인 없이 열린다.
 *                백엔드가 없으므로 `pnpm run dev:online`(.env.online, 더미 데이터 MSW)으로 시작한다.
 *                file= 로 해당 단계 소스를 바로 열고, initialPath= 로 미리보기를 해당 단계 화면으로 연다.
 *   Codespaces : GitHub의 클라우드 개발 환경(브라우저 속 VS Code). .devcontainer 설정으로
 *                JDK 21·Node 22·Docker가 준비되어 MySQL·Spring Boot까지 실행할 수 있다. GitHub 로그인이 필요하다.
 *
 * ★ 둘 다 "GitHub에 올라간 main 브랜치"를 연다. 내 PC에서 고치고 푸시하지 않은 내용은 보이지 않는다.
 *   온라인에서 고친 내용은 원래 저장소에 반영되지 않으므로 마음껏 실습해도 안전하다.
 */

import { learningStageRoutes, type LearningGuide } from "@/features/curriculum/data/learningGuides";

/** 이 프로젝트의 공개 GitHub 저장소와 브랜치. 저장소를 옮기면 여기만 바꾼다. */
export const ONLINE_PRACTICE_REPOSITORY = "Noono0/2026_08_react_spring_devnote";
export const ONLINE_PRACTICE_BRANCH = "main";

/**
 * 단계에서 먼저 열어 볼 소스 파일(frontend 기준 경로).
 * relatedFiles 중 "src/로 시작하는 .ts·.tsx 파일" 첫 번째를 쓴다(폴더나 backend 경로는 건너뛴다).
 */
export const findPracticeSourceFile = (learningGuide: LearningGuide): string | undefined =>
  learningGuide.relatedFiles.find((relatedFile) => relatedFile.startsWith("src/") && /\.tsx?$/.test(relatedFile));

/** StackBlitz 주소. frontend 폴더를 열고, 더미 데이터 모드로 시작하고, 단계 파일과 화면을 바로 보여 준다. */
export const createStackBlitzUrl = (learningGuide: LearningGuide): string => {
  // URLSearchParams가 경로 속 "/"나 한글을 주소에 안전한 형태로 바꿔 준다.
  const searchParameters = new URLSearchParams({ startScript: "dev:online" });
  const sourceFile = findPracticeSourceFile(learningGuide);
  if (sourceFile) searchParameters.set("file", sourceFile);
  const stageRoute = learningStageRoutes[learningGuide.guideId];
  if (stageRoute) searchParameters.set("initialPath", stageRoute);
  return `https://stackblitz.com/github/${ONLINE_PRACTICE_REPOSITORY}/tree/${ONLINE_PRACTICE_BRANCH}/frontend?${searchParameters.toString()}`;
};

/**
 * Codespaces 주소. quickstart=1이면 이미 만든 Codespace가 있을 때 새로 만들지 않고 다시 연다.
 * (Codespaces는 특정 파일을 여는 주소 옵션이 없어, 화면에서 열어 볼 파일 경로를 따로 안내한다)
 */
export const createCodespacesUrl = (): string =>
  `https://codespaces.new/${ONLINE_PRACTICE_REPOSITORY}?quickstart=1&ref=${ONLINE_PRACTICE_BRANCH}`;
