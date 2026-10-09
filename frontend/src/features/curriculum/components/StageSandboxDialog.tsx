/**
 * StageSandboxDialog.tsx — 학습 화면 안에서 바로 코드를 고치고 실행하는 편집기(Sandpack)
 *
 * [동작]
 *   SandpackProvider가 브라우저 안에 작은 React 프로젝트(/App.tsx + /styles.css)를 만들고,
 *   왼쪽 편집기(SandpackCodeEditor)에서 고치면 오른쪽 미리보기(SandpackPreview)가 즉시 다시 실행된다.
 *   번들링은 CodeSandbox가 제공하는 서버에서 하므로 인터넷 연결이 필요하다.
 *
 * [지연 로딩]
 *   Sandpack과 예제 25개 원문은 크다. 이 컴포넌트는 OnlinePracticeMenu가 lazy()로 불러와,
 *   "이 화면에서 바로 편집"을 눌렀을 때만 내려받는다(첫 화면 속도에 영향 없음).
 */
import { SandpackCodeEditor, SandpackConsole, SandpackLayout, SandpackPreview, SandpackProvider, useSandpack } from "@codesandbox/sandpack-react";
import type { LearningGuide } from "@/features/curriculum/data/learningGuides";
import { sandboxDependencies, sandboxStyles } from "@/features/curriculum/sandbox/sandboxSetup";
import { stageSandboxSources } from "@/features/curriculum/sandbox/stageSandboxes";
import { ModalDialog } from "@/shared/ui/ModalDialog";

interface StageSandboxDialogProperties {
  learningGuide: LearningGuide;
  isOpen: boolean;
  onRequestClose: () => void;
}

/** 고친 코드를 처음 예제로 되돌리는 버튼. useSandpack은 SandpackProvider 안에서만 쓸 수 있어 따로 뺐다. */
function ResetButton() {
  const { sandpack } = useSandpack();
  return <button type="button" className="secondary-button" onClick={() => sandpack.resetAllFiles()}>처음 코드로 되돌리기</button>;
}

const StageSandboxDialog = ({ learningGuide, isOpen, onRequestClose }: StageSandboxDialogProperties) => {
  const source = stageSandboxSources[learningGuide.guideId];

  return (
    <ModalDialog
      isOpen={isOpen}
      title={`${learningGuide.stageNumber}단계 · ${learningGuide.title} 직접 해 보기`}
      description="왼쪽 코드를 고치면 오른쪽 화면이 바로 바뀝니다. 고친 내용은 이 창을 닫으면 사라지고, 실제 사이트 코드에는 영향이 없습니다."
      size="large"
      resizable
      resizeStorageKey="stage-sandbox"
      onRequestClose={onRequestClose}
      footer={<button type="button" onClick={onRequestClose}>닫기</button>}
    >
      {source ? (
        // key: 단계가 바뀌면 편집기를 새로 만들어 이전 단계 코드가 섞이지 않게 한다.
        <SandpackProvider
          key={learningGuide.guideId}
          template="react-ts"
          files={{ "/App.tsx": source, "/styles.css": sandboxStyles }}
          customSetup={{ dependencies: sandboxDependencies }}
          // initMode "immediate": 사용자가 버튼을 눌러 연 창이므로 "화면에 보이면 시작"을 기다리지 않고 바로 실행한다.
          options={{ activeFile: "/App.tsx", visibleFiles: ["/App.tsx"], recompileMode: "delayed", recompileDelay: 500, initMode: "immediate" }}
        >
          <div className="stage-sandbox-toolbar">
            <span>{learningGuide.practiceTasks.length > 0 ? "파일 맨 위 주석의 '해 볼 것'부터 시작해 보세요." : ""}</span>
            <ResetButton />
          </div>
          <SandpackLayout className="stage-sandbox-layout">
            <SandpackCodeEditor showLineNumbers showTabs={false} wrapContent style={{ height: 460 }} />
            <SandpackPreview showOpenInCodeSandbox={false} style={{ height: 460 }} />
          </SandpackLayout>
          {/* console.log 결과(20단계 렌더링 횟수 등)를 여기서 본다 */}
          <SandpackConsole className="stage-sandbox-console" style={{ height: 140 }} />
        </SandpackProvider>
      ) : (
        <p className="state-panel">이 단계에는 아직 편집기 예제가 없습니다.</p>
      )}
    </ModalDialog>
  );
};

export default StageSandboxDialog;
