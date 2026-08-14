import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MarkdownFormattingToolbar } from "@/features/utility/components/MarkdownFormattingToolbar";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { applyMarkdownCommand, type MarkdownEditorCommand } from "@/features/utility/utils/markdownEditorCommands";
import { createMarkdownHtmlDocument, renderMarkdown } from "@/features/utility/utils/markdownRenderer";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const exampleMarkdown = `# 가장 큰 제목 (H1)
## 두 번째로 큰 제목 (H2)
### 세 번째로 큰 제목 (H3)
#### 네 번째 크기 제목 (H4)
##### 다섯 번째 크기 제목 (H5)
###### 가장 작은 제목 (H6)

*기울임꼴* 또는 _기울임꼴_
**굵은 글씨** 또는 __굵은 글씨__
***굵은 기울임꼴***
~~취소선~~
<u>밑줄</u>

- 사과
- 바나나
- 포도

1. 첫 번째 순서
1. 두 번째 순서
2. 세 번째 순서

- [ ] 아직 안 한 일
- [x] 이미 끝낸 일

> 중요한 내용을 인용문으로 표시합니다.

[안전한 링크](https://example.com)와 ![이미지 설명](https://placehold.co/480x180)을 사용할 수 있습니다.

---

***

___

| 이름 | 나이 | 직업 |
| :--- | :---: | ---: |
| 민수 | 20 | 학생 |
| 영희 | 25 | 개발자 |

\`인라인 코드\`

\`\`\`typescript
const message: string = "Hello DevNote";
console.log(message);
\`\`\``;

const HISTORY_LIMIT = 100;

export const MarkdownEditorPage = () => {
  const [source, setSource] = useState(exampleMarkdown);
  const [viewMode, setViewMode] = useState<"SPLIT" | "EDITOR" | "PREVIEW">("SPLIT");
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const editorReference = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionReference = useRef<{ start: number; end: number } | undefined>(undefined);
  const undoHistoryReference = useRef<string[]>([]);
  const redoHistoryReference = useRef<string[]>([]);
  const renderedHtml = useMemo(() => renderMarkdown(source), [source]);
  const wordCount = source.trim() ? source.trim().split(/\s+/).length : 0;

  useLayoutEffect(() => {
    const pendingSelection = pendingSelectionReference.current;
    const editor = editorReference.current;
    if (!pendingSelection || !editor) return;
    editor.focus();
    editor.setSelectionRange(pendingSelection.start, pendingSelection.end);
    setSelectionRange(pendingSelection);
    pendingSelectionReference.current = undefined;
  }, [source]);

  const updateSourceWithHistory = (nextSource: string): void => {
    if (nextSource === source) return;
    undoHistoryReference.current = [...undoHistoryReference.current, source].slice(-HISTORY_LIMIT);
    redoHistoryReference.current = [];
    setSource(nextSource);
  };

  const undo = (): void => {
    const previousSource = undoHistoryReference.current.at(-1);
    if (previousSource === undefined) return;
    undoHistoryReference.current = undoHistoryReference.current.slice(0, -1);
    redoHistoryReference.current = [...redoHistoryReference.current, source].slice(-HISTORY_LIMIT);
    pendingSelectionReference.current = { start: previousSource.length, end: previousSource.length };
    setSource(previousSource);
  };

  const redo = (): void => {
    const nextSource = redoHistoryReference.current.at(-1);
    if (nextSource === undefined) return;
    redoHistoryReference.current = redoHistoryReference.current.slice(0, -1);
    undoHistoryReference.current = [...undoHistoryReference.current, source].slice(-HISTORY_LIMIT);
    pendingSelectionReference.current = { start: nextSource.length, end: nextSource.length };
    setSource(nextSource);
  };

  const applyCommand = (command: MarkdownEditorCommand): void => {
    const editor = editorReference.current;
    const selectionStart = editor?.selectionStart ?? selectionRange.start;
    const selectionEnd = editor?.selectionEnd ?? selectionRange.end;
    const result = applyMarkdownCommand(source, selectionStart, selectionEnd, command);
    pendingSelectionReference.current = { start: result.selectionStart, end: result.selectionEnd };
    if (result.value === source && editor) {
      editor.focus();
      editor.setSelectionRange(result.selectionStart, result.selectionEnd);
      pendingSelectionReference.current = undefined;
    } else updateSourceWithHistory(result.value);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLocaleLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (key === "y") {
      event.preventDefault();
      redo();
      return;
    }
    const command = key === "b" ? "BOLD"
      : key === "i" ? "ITALIC"
        : key === "u" ? "UNDERLINE"
          : key === "x" && event.shiftKey ? "STRIKETHROUGH"
            : undefined;
    if (!command) return;
    event.preventDefault();
    applyCommand(command);
  };

  const updateSelection = (): void => {
    const editor = editorReference.current;
    if (editor) setSelectionRange({ start: editor.selectionStart, end: editor.selectionEnd });
  };

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Documentation" title="Markdown Editor" description="Markdown을 작성하면서 정화된 HTML 미리보기를 확인하고 .md 또는 .html로 내보냅니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="utility-toolbar">
        <div className="segmented-buttons" role="group" aria-label="Markdown 화면 모드"><button type="button" className={viewMode === "SPLIT" ? "active" : undefined} onClick={() => setViewMode("SPLIT")}>분할</button><button type="button" className={viewMode === "EDITOR" ? "active" : undefined} onClick={() => setViewMode("EDITOR")}>편집기</button><button type="button" className={viewMode === "PREVIEW" ? "active" : undefined} onClick={() => setViewMode("PREVIEW")}>미리보기</button></div>
        <span>{source.length.toLocaleString("ko-KR")}자 · {wordCount.toLocaleString("ko-KR")}단어</span>
        <button type="button" className="ghost-button" aria-keyshortcuts="Control+Z" disabled={undoHistoryReference.current.length === 0} onClick={undo}>실행 취소</button>
        <button type="button" className="ghost-button" aria-keyshortcuts="Control+Y" disabled={redoHistoryReference.current.length === 0} onClick={redo}>다시 실행</button>
        <button type="button" className="ghost-button" onClick={() => void copyText(source).then(() => applicationNotification.success("Markdown을 복사했습니다."))}>Markdown 복사</button>
        <button type="button" className="ghost-button" onClick={() => void copyText(renderedHtml).then(() => applicationNotification.success("HTML을 복사했습니다."))}>HTML 복사</button>
        <button type="button" className="ghost-button" onClick={() => downloadText("document.md", source, "text/markdown;charset=utf-8")}>.md 다운로드</button>
        <button type="button" className="ghost-button" onClick={() => downloadText("document.html", createMarkdownHtmlDocument("Markdown 문서", renderedHtml), "text/html;charset=utf-8")}>.html 다운로드</button>
        <button type="button" className="ghost-button" onClick={() => { updateSourceWithHistory(""); setSelectionRange({ start: 0, end: 0 }); }}>초기화</button>
      </div>
      {viewMode !== "PREVIEW" ? <section className="markdown-toolbar-panel">
        <header><div><strong>시각적 서식 도구</strong><span>글자나 여러 줄을 선택한 뒤 버튼을 누르세요.</span></div><span aria-live="polite">{selectionRange.end > selectionRange.start ? `${(selectionRange.end - selectionRange.start).toLocaleString("ko-KR")}자 선택됨` : "커서 위치에 새 서식 삽입"}</span></header>
        <MarkdownFormattingToolbar onCommand={applyCommand} />
      </section> : null}
      <div className={`markdown-workspace markdown-${viewMode.toLowerCase()}`}>
        {viewMode !== "PREVIEW" ? <label className="markdown-editor"><span>Markdown 입력 · Ctrl+Z 실행 취소 · Ctrl+Y 다시 실행 · Ctrl+B 굵게 · Ctrl+I 기울임</span><textarea ref={editorReference} aria-label="Markdown 입력" value={source} spellCheck={false} onKeyDown={handleEditorKeyDown} onSelect={updateSelection} onChange={(event) => { updateSourceWithHistory(event.target.value); setSelectionRange({ start: event.target.selectionStart, end: event.target.selectionEnd }); }} /></label> : null}
        {viewMode !== "EDITOR" ? <section className="markdown-preview-panel" aria-label="Markdown 미리보기"><header>미리보기</header><article className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderedHtml }} /></section> : null}
      </div>
      <UtilityHelpDialog isOpen={helpOpen} title="Markdown Editor" description="가벼운 문서 문법을 HTML로 바꾸고 안전하게 미리봅니다." onClose={() => setHelpOpen(false)}>
        <article><h3>버튼으로 서식 적용</h3><p>글자나 여러 줄을 선택하고 툴바 버튼을 누르면 Markdown 문법을 적용합니다. <kbd>Ctrl+Z</kbd>로 실행 취소하고 <kbd>Ctrl+Y</kbd> 또는 <kbd>Ctrl+Shift+Z</kbd>로 다시 실행할 수 있습니다. 본문을 직접 꾸미는 완전한 WYSIWYG 대신 원문과 결과를 함께 배우는 시각적 편집 방식입니다.</p></article>
        <article><h3>1. 제목 (Headers)</h3><p><code>#</code> 뒤를 한 칸 띄우며, 개수가 많아질수록 제목이 작아집니다.</p><pre><code>{`# 가장 큰 제목 (H1)
## 두 번째로 큰 제목 (H2)
### 세 번째로 큰 제목 (H3)
#### 네 번째 크기 제목 (H4)
##### 다섯 번째 크기 제목 (H5)
###### 가장 작은 제목 (H6)`}</code></pre></article>
        <article><h3>2. 글자 스타일 (Text Styles)</h3><pre><code>{`*기울임꼴* 또는 _기울임꼴_
**굵은 글씨** 또는 __굵은 글씨__
***굵은 기울임꼴***
~~취소선~~
<u>밑줄</u>`}</code></pre></article>
        <article><h3>3. 목록 (Lists)</h3><p>순서 없는 목록은 <code>*</code>, <code>+</code>, <code>-</code>를 사용할 수 있습니다. 번호 목록은 모두 <code>1.</code>로 써도 화면에서 순서대로 표시됩니다.</p><pre><code>{`* 사과
- 바나나
+ 포도

1. 첫 번째
1. 두 번째
1. 세 번째`}</code></pre></article>
        <article><h3>4. 할 일 목록 (Task Lists)</h3><p>대괄호 안의 공백은 미완료, <code>x</code>는 완료 상태입니다.</p><pre><code>{`- [ ] 아직 안 한 일
- [x] 이미 끝낸 일`}</code></pre></article>
        <article><h3>5. 인용구 (Blockquotes)</h3><pre><code>{`> 여기에 중요한 내용을 적거나,
> 다른 사람의 글을 인용할 때 사용합니다.`}</code></pre></article>
        <article><h3>6. 코드 넣기 (Code)</h3><p>짧은 코드는 백틱 한 개, 여러 줄은 백틱 세 개와 언어 이름을 사용합니다. 툴바의 언어 선택으로 JavaScript, TypeScript, Python, Java, SQL, JSON, HTML, CSS, Bash 강조를 적용할 수 있습니다.</p><pre><code>{`이곳은 \`짧은 코드\`를 넣는 자리입니다.

\`\`\`javascript
const message = "안녕하세요";
console.log(message);
\`\`\``}</code></pre></article>
        <article><h3>7. 링크와 이미지 (Links &amp; Images)</h3><p>안전을 위해 미리보기는 <code>http://</code> 또는 <code>https://</code> 주소만 링크와 이미지로 변환합니다.</p><pre><code>{`[네이버 홈페이지](https://naver.com)
![이미지 설명글](https://example.com/image.png)`}</code></pre></article>
        <article><h3>8. 가로선 (Horizontal Rules)</h3><p>아래 세 문법을 모두 구역을 나누는 선으로 표시합니다.</p><pre><code>{`---
***
___`}</code></pre></article>
        <article><h3>9. 표 만들기 (Tables)</h3><p>제목 아래 구분 행의 콜론 위치에 따라 왼쪽·가운데·오른쪽으로 정렬됩니다.</p><pre><code>{`| 이름 | 나이 | 직업 |
| :--- | :---: | ---: |
| 민수 | 20 | 학생 |
| 영희 | 25 | 개발자 |`}</code></pre><ul><li><code>:---</code> 왼쪽 정렬</li><li><code>:---:</code> 가운데 정렬</li><li><code>---:</code> 오른쪽 정렬</li></ul></article>
        <article><h3>안전한 미리보기</h3><p>Markdown 문자열을 HTML로 바꾼 뒤 DOMPurify로 위험한 태그와 속성을 제거합니다. HTML 다운로드에도 같은 정화 결과를 사용합니다.</p></article>
      </UtilityHelpDialog>
    </section>
  );
};
