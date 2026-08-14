import { useState, type MouseEvent, type ReactNode } from "react";
import type { MarkdownCodeLanguage, MarkdownEditorCommand } from "@/features/utility/utils/markdownEditorCommands";

interface MarkdownFormattingToolbarProps {
  onCommand: (command: MarkdownEditorCommand) => void;
}

interface ToolbarButtonProps {
  command: MarkdownEditorCommand;
  label: string;
  title: string;
  shortcut?: string;
  children?: ReactNode;
  onCommand: (command: MarkdownEditorCommand) => void;
}

const ToolbarButton = ({ command, label, title, shortcut, children, onCommand }: ToolbarButtonProps) => {
  const preserveEditorSelection = (event: MouseEvent<HTMLButtonElement>): void => event.preventDefault();
  return <button type="button" aria-label={label} aria-keyshortcuts={shortcut} title={shortcut ? `${title} · ${shortcut}` : title} onMouseDown={preserveEditorSelection} onClick={() => onCommand(command)}>{children ?? label}</button>;
};

export const MarkdownFormattingToolbar = ({ onCommand }: MarkdownFormattingToolbarProps) => {
  const [codeLanguage, setCodeLanguage] = useState<MarkdownCodeLanguage>("JAVASCRIPT");

  return <div className="markdown-formatting-toolbar" aria-label="Markdown 서식 도구">
    <div role="group" aria-label="제목 서식">
      {([1, 2, 3, 4, 5, 6] as const).map((level) => <ToolbarButton key={level} command={`HEADING_${level}`} label={`제목 ${level}단계 적용`} title={`H${level} 제목으로 변경`} onCommand={onCommand}>H{level}</ToolbarButton>)}
    </div>
    <div role="group" aria-label="글자 서식">
      <ToolbarButton command="BOLD" label="굵게 적용" title="선택 글자를 굵게" shortcut="Control+B" onCommand={onCommand}><strong>B</strong></ToolbarButton>
      <ToolbarButton command="ITALIC" label="기울임 적용" title="선택 글자를 기울임꼴로" shortcut="Control+I" onCommand={onCommand}><em>I</em></ToolbarButton>
      <ToolbarButton command="BOLD_ITALIC" label="굵은 기울임 적용" title="굵은 기울임꼴" onCommand={onCommand}><strong><em>BI</em></strong></ToolbarButton>
      <ToolbarButton command="STRIKETHROUGH" label="취소선 적용" title="선택 글자에 취소선" shortcut="Control+Shift+X" onCommand={onCommand}><s>S</s></ToolbarButton>
      <ToolbarButton command="UNDERLINE" label="밑줄 적용" title="안전한 u 태그로 밑줄" shortcut="Control+U" onCommand={onCommand}><u>U</u></ToolbarButton>
      <ToolbarButton command="INLINE_CODE" label="인라인 코드 적용" title="선택 글자를 인라인 코드로" onCommand={onCommand}><code>&lt;/&gt;</code></ToolbarButton>
    </div>
    <div role="group" aria-label="문단 서식">
      <ToolbarButton command="UNORDERED_LIST" label="글머리 기호 목록 적용" title="선택한 줄을 글머리 기호 목록으로" onCommand={onCommand}>• 목록</ToolbarButton>
      <ToolbarButton command="ORDERED_LIST" label="번호 목록 적용" title="선택한 줄을 번호 목록으로" onCommand={onCommand}>1. 목록</ToolbarButton>
      <ToolbarButton command="TASK_LIST" label="할 일 목록 적용" title="선택한 줄을 빈 체크박스 목록으로" onCommand={onCommand}>☐ 할 일</ToolbarButton>
      <ToolbarButton command="BLOCKQUOTE" label="인용문 적용" title="선택한 줄을 인용문으로" onCommand={onCommand}>❝ 인용</ToolbarButton>
      <label className="markdown-code-language">코드 언어<select aria-label="코드 블록 언어" value={codeLanguage} onChange={(event) => setCodeLanguage(event.target.value as MarkdownCodeLanguage)}><option value="JAVASCRIPT">JavaScript</option><option value="TYPESCRIPT">TypeScript</option><option value="PYTHON">Python</option><option value="JAVA">Java</option><option value="SQL">SQL</option><option value="JSON">JSON</option><option value="HTML">HTML</option><option value="CSS">CSS</option><option value="BASH">Bash</option></select></label>
      <ToolbarButton command={`CODE_BLOCK_${codeLanguage}`} label="코드 블록 적용" title="선택 영역을 언어가 지정된 코드 블록으로" onCommand={onCommand}>코드 블록</ToolbarButton>
    </div>
    <div role="group" aria-label="삽입 도구">
      <ToolbarButton command="LINK" label="링크 삽입" title="HTTP(S) 링크 문법 삽입" onCommand={onCommand}>🔗 링크</ToolbarButton>
      <ToolbarButton command="IMAGE" label="이미지 삽입" title="HTTP(S) 이미지 문법 삽입" onCommand={onCommand}>▧ 이미지</ToolbarButton>
      <ToolbarButton command="TABLE" label="표 삽입" title="왼쪽·가운데·오른쪽 정렬 예제 표 삽입" onCommand={onCommand}>▦ 표</ToolbarButton>
      <ToolbarButton command="HORIZONTAL_RULE" label="구분선 삽입" title="문단 구분선 삽입" onCommand={onCommand}>― 구분선</ToolbarButton>
    </div>
  </div>;
};
