/**
 * StageSandboxPanel.tsx — 연습 화면 아래에서 바로 코드를 고치고 실행하는 편집기(Sandpack)
 *
 * [동작]
 *   SandpackProvider가 브라우저 안에 작은 React 프로젝트(/App.tsx + /styles.css)를 만들고,
 *   왼쪽 편집기(SandpackCodeEditor)에서 고치면 오른쪽 미리보기(SandpackPreview)가 다시 실행된다.
 *   번들링은 CodeSandbox가 제공하는 서버에서 하므로 인터넷 연결이 필요하다.
 *
 * [색 테마]
 *   편집기·콘솔 색은 SandpackProvider의 theme으로, 미리보기 색은 /styles.css의 CSS 변수로 바꾼다(sandboxThemes.ts).
 *   ★ Sandpack은 files·customSetup 객체가 "새 객체"로 바뀌면(내용이 같아도) 고친 코드를 모두 처음으로 되돌린다.
 *     테마를 바꾸면 이 컴포넌트가 다시 그려지며 객체를 새로 만들게 되므로, useMemo로 단계(source)가 같으면 같은 객체를 쓴다.
 *     미리보기 색은 files를 바꾸지 않고 PreviewThemeSync가 /styles.css 한 파일만 updateFile로 바꾼다(고친 App.tsx는 그대로).
 *
 * [크기 조절]
 *   편집기·미리보기 사이 세로 막대로 좌우 비율, 아래 가로 막대로 높이를 바꾼다(SandboxResizeHandle).
 *   값은 stageSandboxStore에 저장되고, 아래 frameStyle의 CSS 변수로 화면에 반영된다.
 *   760px 이하 좁은 화면은 위아래로 쌓이므로 손잡이를 숨긴다(global.css).
 *
 * [지연 로딩]
 *   Sandpack과 예제 25개 원문은 크다. StageSandboxSection이 lazy()로 불러와,
 *   편집기 영역을 펼쳤을 때만 내려받는다(첫 화면 속도에 영향 없음).
 */
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { SandpackCodeEditor, SandpackConsole, SandpackLayout, SandpackPreview, SandpackProvider, useSandpack } from "@codesandbox/sandpack-react";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";
import { SandboxResizeHandle } from "@/features/curriculum/components/SandboxResizeHandle";
import type { LearningGuide } from "@/features/curriculum/data/learningGuides";
import { selectSandboxDependencies } from "@/features/curriculum/sandbox/sandboxSetup";
import { createSandboxStyles, isSandboxThemeChoice, resolveSandboxTheme, sandboxEditorThemes, sandboxThemeChoices, sandboxThemeLabels } from "@/features/curriculum/sandbox/sandboxThemes";
import { stageSandboxSources } from "@/features/curriculum/sandbox/stageSandboxes";
import { SANDBOX_EDITOR_WIDTH_RANGE, SANDBOX_LAYOUT_HEIGHT_RANGE, useStageSandboxStore } from "@/features/curriculum/state/stageSandboxStore";

interface StageSandboxPanelProperties {
  learningGuide: LearningGuide;
}

/** 고친 코드를 처음 예제로 되돌리는 버튼. useSandpack은 SandpackProvider 안에서만 쓸 수 있어 따로 뺐다. */
function ResetButton() {
  const { sandpack } = useSandpack();
  return <button type="button" className="secondary-button" onClick={() => sandpack.resetAllFiles()}>처음 코드로 되돌리기</button>;
}

/**
 * 미리보기의 /styles.css를 지금 테마 색으로 맞춘다.
 * 테마를 바꿨을 때뿐 아니라 "처음 코드로 되돌리기"로 styles.css가 처음 색으로 돌아갔을 때도 다시 맞춘다.
 * 내용이 이미 같으면 아무것도 하지 않으므로 무한 반복되지 않는다.
 */
function PreviewThemeSync({ styles }: { styles: string }) {
  const { sandpack } = useSandpack();
  const currentStyles = sandpack.files["/styles.css"]?.code;
  useEffect(() => {
    if (currentStyles !== styles) sandpack.updateFile("/styles.css", styles);
  }, [currentStyles, styles, sandpack]);
  return null;
}

const StageSandboxPanel = ({ learningGuide }: StageSandboxPanelProperties) => {
  const siteTheme = useApplicationUiStore((state) => state.applicationTheme);
  const themeChoice = useStageSandboxStore((state) => state.themeChoice);
  const setThemeChoice = useStageSandboxStore((state) => state.setThemeChoice);
  const themeName = resolveSandboxTheme(themeChoice, siteTheme);
  const styles = createSandboxStyles(themeName);
  const source = stageSandboxSources[learningGuide.guideId];

  // useMemo를 쓰는 이유: 위 [색 테마] 설명처럼 객체가 바뀌면 Sandpack이 고친 코드를 되돌린다.
  // 그래서 테마(styles)는 의존성에 넣지 않고, 편집기를 처음 만들 때의 테마 색만 getState()로 한 번 읽는다.
  // 그 뒤 색 변경은 PreviewThemeSync가 맡는다.
  const sandpackFiles = useMemo(() => {
    if (!source) return undefined;
    const firstThemeName = resolveSandboxTheme(useStageSandboxStore.getState().themeChoice, useApplicationUiStore.getState().applicationTheme);
    return { "/App.tsx": source, "/styles.css": createSandboxStyles(firstThemeName) };
  }, [source]);
  const customSetup = useMemo(() => (source ? { dependencies: selectSandboxDependencies(source) } : undefined), [source]);

  // ── 크기 조절 ──────────────────────────────────────────
  const editorWidthPercent = useStageSandboxStore((state) => state.editorWidthPercent);
  const layoutHeight = useStageSandboxStore((state) => state.layoutHeight);
  const setEditorWidthPercent = useStageSandboxStore((state) => state.setEditorWidthPercent);
  const setLayoutHeight = useStageSandboxStore((state) => state.setLayoutHeight);
  // 편집기·미리보기를 감싼 상자. 포인터 위치를 "상자 안에서 몇 %·몇 px인지"로 바꿀 때 상자 위치가 필요하다.
  const frameRef = useRef<HTMLDivElement>(null);

  /** 세로 막대를 끌면: 상자 왼쪽 끝에서 포인터까지 거리 ÷ 상자 너비 = 편집기 너비(%) */
  const resizeWidthByPointer = (clientX: number): void => {
    const frameRectangle = frameRef.current?.getBoundingClientRect();
    if (!frameRectangle || frameRectangle.width === 0) return;
    setEditorWidthPercent(((clientX - frameRectangle.left) / frameRectangle.width) * 100);
  };

  /** 가로 막대를 끌면: 상자 위쪽 끝에서 포인터까지 거리 = 새 높이(px) */
  const resizeHeightByPointer = (clientY: number): void => {
    const frameRectangle = frameRef.current?.getBoundingClientRect();
    if (frameRectangle) setLayoutHeight(clientY - frameRectangle.top);
  };

  // 방향키 한 번에 바꿀 양. 지금 값은 getState()로 "가장 최신 값"을 읽는다.
  // (렌더링 때 받아 둔 값을 쓰면 키를 빠르게 여러 번 누를 때 옛날 값으로 계산되는 stale closure가 생길 수 있다)
  const stepEditorWidth = (direction: -1 | 1, large: boolean): void =>
    setEditorWidthPercent(useStageSandboxStore.getState().editorWidthPercent + direction * (large ? 15 : 5));
  const stepLayoutHeight = (direction: -1 | 1, large: boolean): void =>
    setLayoutHeight(useStageSandboxStore.getState().layoutHeight + direction * (large ? 120 : 40));

  // CSS 변수로 크기를 넘긴다. 타입 단언(as) 없이 "--"로 시작하는 이름을 쓸 수 있게 타입을 넓혔다.
  const frameStyle: CSSProperties & Record<`--${string}`, string> = {
    "--sandbox-editor-width": `${editorWidthPercent}%`,
    "--sp-layout-height": `${layoutHeight}px`,
  };

  if (!source || !sandpackFiles) return <p className="state-panel">이 단계에는 아직 편집기 예제가 없습니다.</p>;

  return (
    // key: 단계가 바뀌면 편집기를 새로 만들어 이전 단계 코드가 섞이지 않게 한다.
    <SandpackProvider
      key={learningGuide.guideId}
      template="react-ts"
      theme={sandboxEditorThemes[themeName]}
      files={sandpackFiles}
      // 이 예제가 import하는 패키지만 설치한다(필요 없는 패키지 때문에 미리보기가 멈추지 않게).
      customSetup={customSetup}
      // ★ initMode는 기본값("lazy": 미리보기가 화면에 보이면 시작)을 그대로 쓴다.
      //   "immediate"로 바꾸면 개발 모드의 StrictMode가 컴포넌트를 두 번 붙였다 떼는 사이에 미리보기 연결이
      //   만들어졌다 끊겨, 번들러는 실행을 끝냈는데 화면은 "로딩 중"(흰 화면)에 멈췄다(운영 빌드는 정상).
      options={{ activeFile: "/App.tsx", visibleFiles: ["/App.tsx"], recompileMode: "delayed", recompileDelay: 500 }}
    >
      <PreviewThemeSync styles={styles} />
      <div className="stage-sandbox-toolbar">
        <span>파일 맨 위 주석의 &apos;해 볼 것&apos;부터 시작해 보세요. 고친 내용은 접거나 다른 화면으로 가면 사라지고, 실제 사이트 코드에는 영향이 없습니다.</span>
        <div className="stage-sandbox-toolbar-actions">
          <label className="stage-sandbox-theme">
            색 테마
            <select
              value={themeChoice}
              onChange={(event) => {
                // select 값도 문자열일 뿐이라, 우리가 아는 테마 값인지 확인하고 저장한다.
                if (isSandboxThemeChoice(event.target.value)) setThemeChoice(event.target.value);
              }}
            >
              {sandboxThemeChoices.map((choice) => <option key={choice} value={choice}>{sandboxThemeLabels[choice]}</option>)}
            </select>
          </label>
          <ResetButton />
        </div>
      </div>
      <div ref={frameRef} className="stage-sandbox-frame" style={frameStyle}>
        <SandpackLayout className="stage-sandbox-layout">
          <SandpackCodeEditor showLineNumbers showTabs={false} wrapContent className="stage-sandbox-editor" />
          <SandboxResizeHandle
            orientation="vertical"
            label={`편집기 너비 조절 (지금 ${editorWidthPercent}%)`}
            onDrag={(clientX) => resizeWidthByPointer(clientX)}
            onStep={stepEditorWidth}
            onReset={() => setEditorWidthPercent(SANDBOX_EDITOR_WIDTH_RANGE.initial)}
          />
          <SandpackPreview showOpenInCodeSandbox={false} className="stage-sandbox-preview" />
        </SandpackLayout>
        <SandboxResizeHandle
          orientation="horizontal"
          label={`편집기 높이 조절 (지금 ${layoutHeight}px)`}
          onDrag={(_clientX, clientY) => resizeHeightByPointer(clientY)}
          onStep={stepLayoutHeight}
          onReset={() => setLayoutHeight(SANDBOX_LAYOUT_HEIGHT_RANGE.initial)}
        />
      </div>
      {/* console.log 결과(20단계 렌더링 횟수 등)를 여기서 본다. 이름 없는 빈 상자로 보이지 않게 제목을 붙였다. */}
      <p className="stage-sandbox-console-title">
        <strong>콘솔</strong> 코드의 <code>console.log()</code> 출력이 여기에 나옵니다. 비어 있으면 아직 출력한 내용이 없는 것입니다.
      </p>
      <SandpackConsole className="stage-sandbox-console" />
    </SandpackProvider>
  );
};

export default StageSandboxPanel;
