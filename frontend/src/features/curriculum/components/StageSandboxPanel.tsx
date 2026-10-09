/**
 * StageSandboxPanel.tsx — 연습 화면 아래에서 바로 코드를 고치고 실행하는 편집기(Sandpack)
 *
 * [동작]
 *   SandpackProvider가 브라우저 안에 작은 React 프로젝트(/App.tsx + /styles.css)를 만들고,
 *   왼쪽 편집기(SandpackCodeEditor)에서 고치면 오른쪽 미리보기(SandpackPreview)가 다시 실행된다.
 *   번들링은 CodeSandbox가 제공하는 서버에서 하므로 인터넷 연결이 필요하다.
 *
 * [지연 로딩]
 *   Sandpack과 예제 25개 원문은 크다. StageSandboxSection이 lazy()로 불러와,
 *   편집기 영역을 펼쳤을 때만 내려받는다(첫 화면 속도에 영향 없음).
 */
import { SandpackCodeEditor, SandpackConsole, SandpackLayout, SandpackPreview, SandpackProvider, useSandpack } from "@codesandbox/sandpack-react";
import type { LearningGuide } from "@/features/curriculum/data/learningGuides";
import { sandboxStyles, selectSandboxDependencies } from "@/features/curriculum/sandbox/sandboxSetup";
import { stageSandboxSources } from "@/features/curriculum/sandbox/stageSandboxes";

interface StageSandboxPanelProperties {
  learningGuide: LearningGuide;
}

/** 고친 코드를 처음 예제로 되돌리는 버튼. useSandpack은 SandpackProvider 안에서만 쓸 수 있어 따로 뺐다. */
function ResetButton() {
  const { sandpack } = useSandpack();
  return <button type="button" className="secondary-button" onClick={() => sandpack.resetAllFiles()}>처음 코드로 되돌리기</button>;
}

const StageSandboxPanel = ({ learningGuide }: StageSandboxPanelProperties) => {
  const source = stageSandboxSources[learningGuide.guideId];
  if (!source) return <p className="state-panel">이 단계에는 아직 편집기 예제가 없습니다.</p>;

  return (
    // key: 단계가 바뀌면 편집기를 새로 만들어 이전 단계 코드가 섞이지 않게 한다.
    <SandpackProvider
      key={learningGuide.guideId}
      template="react-ts"
      files={{ "/App.tsx": source, "/styles.css": sandboxStyles }}
      // 이 예제가 import하는 패키지만 설치한다(필요 없는 패키지 때문에 미리보기가 멈추지 않게).
      customSetup={{ dependencies: selectSandboxDependencies(source) }}
      // ★ initMode는 기본값("lazy": 미리보기가 화면에 보이면 시작)을 그대로 쓴다.
      //   "immediate"로 바꾸면 개발 모드의 StrictMode가 컴포넌트를 두 번 붙였다 떼는 사이에 미리보기 연결이
      //   만들어졌다 끊겨, 번들러는 실행을 끝냈는데 화면은 "로딩 중"(흰 화면)에 멈췄다(운영 빌드는 정상).
      options={{ activeFile: "/App.tsx", visibleFiles: ["/App.tsx"], recompileMode: "delayed", recompileDelay: 500 }}
    >
      <div className="stage-sandbox-toolbar">
        <span>파일 맨 위 주석의 &apos;해 볼 것&apos;부터 시작해 보세요. 고친 내용은 접거나 다른 화면으로 가면 사라지고, 실제 사이트 코드에는 영향이 없습니다.</span>
        <ResetButton />
      </div>
      <SandpackLayout className="stage-sandbox-layout">
        <SandpackCodeEditor showLineNumbers showTabs={false} wrapContent className="stage-sandbox-editor" />
        <SandpackPreview showOpenInCodeSandbox={false} className="stage-sandbox-preview" />
      </SandpackLayout>
      {/* console.log 결과(20단계 렌더링 횟수 등)를 여기서 본다. 이름 없는 빈 상자로 보이지 않게 제목을 붙였다. */}
      <p className="stage-sandbox-console-title">
        <strong>콘솔</strong> 코드의 <code>console.log()</code> 출력이 여기에 나옵니다. 비어 있으면 아직 출력한 내용이 없는 것입니다.
      </p>
      <SandpackConsole className="stage-sandbox-console" />
    </SandpackProvider>
  );
};

export default StageSandboxPanel;
