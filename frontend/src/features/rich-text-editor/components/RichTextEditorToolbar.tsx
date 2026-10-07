/**
 * Tiptap 명령을 워드프로세서 형태의 한 줄 도구 모음으로 보여주는 컴포넌트입니다.
 * 에디터 본문·업로드 상태와 분리해 두면 기능이 늘어나도 RichTextEditor의 흐름을 따라가기 쉽습니다.
 *
 * [Tiptap 명령 읽는 법]
 *   editor.chain().focus().toggleBold().run()
 *     chain() : 여러 명령을 이어 붙이기 시작   focus(): 에디터에 커서를 되돌림(버튼을 누르면 포커스가 버튼으로 가기 때문)
 *     toggleBold(): 실제 동작                   run()  : 모아 둔 명령을 한 번에 실행
 *   editor.can().…run() : 실제로 바꾸지 않고 "지금 실행할 수 있는지"만 확인(버튼 비활성화에 사용)
 *   editor.isActive("bold") : 커서 위치에 그 서식이 적용돼 있는지(버튼을 눌린 상태로 표시)
 *
 * 버튼 묶음(role="group")마다 aria-label을 달아 화면 낭독기가 "편집 기록", "글자 스타일"처럼 묶음 이름을 읽게 했다.
 */
import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { RichTextTableMenu } from "@/features/rich-text-editor/components/RichTextTableMenu";
import {
  FONT_SIZE_OPTIONS,
  isSupportedFontSize,
} from "@/features/rich-text-editor/extensions/fontSize";

// 제목 단계(h1~h6)와 화면 배율 선택지.
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const EDITOR_ZOOM_OPTIONS = [75, 90, 100, 110, 125, 150] as const;

interface RichTextEditorToolbarProperties {
  editor: Editor;
  editorLabel: string;
  editorZoomPercentage: number;
  isImageUploading: boolean;
  handleEditorZoomChange: (zoomPercentage: number) => void;
  handleImageButtonClick: () => void;
  handleLinkSetting: () => void;
}

interface ToolbarButtonProperties {
  label: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  extraClassName?: string;
  handleClick: () => void;
}

/**
 * 도구 모음 버튼 하나. aria-pressed로 "켜짐/꺼짐" 상태를 알린다.
 * active를 주지 않으면(undefined) 켜고 끄는 버튼이 아니라 한 번 실행하는 버튼(실행 취소 등)으로 본다.
 */
const ToolbarButton = ({
  label,
  children,
  active,
  disabled = false,
  extraClassName = "",
  handleClick,
}: ToolbarButtonProperties) => (
  <button
    type="button"
    className={`editor-tool-button ${active ? "active" : ""} ${extraClassName}`.trim()}
    aria-label={label}
    aria-pressed={active === undefined ? undefined : active}
    title={label}
    disabled={disabled}
    onClick={handleClick}
  >
    {children}
  </button>
);

/** 정렬 아이콘: 가로줄 네 개를 CSS로 그린다(정렬 종류마다 줄 길이·위치가 다르다). */
const AlignmentIcon = ({ alignment }: { alignment: "left" | "center" | "right" | "justify" }) => (
  <span className={`editor-alignment-icon editor-alignment-icon-${alignment}`} aria-hidden="true">
    <span />
    <span />
    <span />
    <span />
  </span>
);

/** <details> 펼침 메뉴는 open 속성으로 열린다. 항목을 고른 뒤 그 속성을 지워 메뉴를 닫는다. */
const closeToolbarMenu = (event: MouseEvent<HTMLButtonElement>): void => {
  event.currentTarget.closest("details")?.removeAttribute("open");
};

export const RichTextEditorToolbar = ({
  editor,
  editorLabel,
  editorZoomPercentage,
  isImageUploading,
  handleEditorZoomChange,
  handleImageButtonClick,
  handleLinkSetting,
}: RichTextEditorToolbarProperties) => {
  // 마지막으로 고른 글자색·형광펜 색(다음에 같은 색을 바로 쓰기 위해 기억한다).
  const [textColor, setTextColor] = useState("#315efb");
  const [highlightColor, setHighlightColor] = useState("#fff3a3");
  // 커서 위치의 현재 서식을 읽어 선택 상자에 보여 준다. 에디터 내용이 바뀌면 이 컴포넌트가 다시 그려져 값도 갱신된다.
  const activeHeadingLevel = HEADING_LEVELS.find((headingLevel) =>
    editor.isActive("heading", { level: headingLevel }),
  );
  const activeFontFamily = String(editor.getAttributes("textStyle").fontFamily ?? "");
  const activeFontSize = String(editor.getAttributes("textStyle").fontSize ?? "");
  const activeListItemType = editor.isActive("taskList") ? "taskItem" : "listItem";
  const isInsideTable = editor.isActive("table");

  return (
    <div className="editor-toolbar" role="toolbar" aria-label={`${editorLabel} 서식`}>
      {/* ① 실행 취소·다시 실행 */}
      <div className="editor-toolbar-group" role="group" aria-label="편집 기록">
        <ToolbarButton
          label="실행 취소"
          disabled={!editor.can().chain().focus().undo().run()}
          handleClick={() => editor.chain().focus().undo().run()}
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          label="다시 실행"
          disabled={!editor.can().chain().focus().redo().run()}
          handleClick={() => editor.chain().focus().redo().run()}
        >
          ↷
        </ToolbarButton>
      </div>

      {/* ② 화면 배율(본문 확대·축소 — 저장 내용에는 영향 없음) */}
      <div className="editor-toolbar-group" role="group" aria-label="화면 배율">
        <span className="editor-zoom-symbol" aria-hidden="true">
          −
        </span>
        <select
          className="editor-toolbar-select editor-zoom-select"
          aria-label="에디터 화면 배율"
          value={editorZoomPercentage}
          onChange={(event) => handleEditorZoomChange(Number(event.target.value))}
        >
          {EDITOR_ZOOM_OPTIONS.map((zoomPercentage) => (
            <option key={zoomPercentage} value={zoomPercentage}>
              {zoomPercentage}%
            </option>
          ))}
        </select>
        <span className="editor-zoom-symbol" aria-hidden="true">
          ＋
        </span>
      </div>

      {/* ③ 문단·제목 단계, 글꼴, 글자 크기 */}
      <div className="editor-toolbar-group" role="group" aria-label="문단과 글꼴">
        <select
          className="editor-toolbar-select editor-heading-select"
          aria-label="문단 또는 제목 선택"
          value={activeHeadingLevel ? String(activeHeadingLevel) : "paragraph"}
          onChange={(event) => {
            const selectedValue = event.target.value;
            if (selectedValue === "paragraph") {
              editor.chain().focus().setParagraph().run();
              return;
            }
            editor
              .chain()
              .focus()
              .setHeading({ level: Number(selectedValue) as 1 | 2 | 3 | 4 | 5 | 6 })
              .run();
          }}
        >
          <option value="paragraph">본문</option>
          {HEADING_LEVELS.map((headingLevel) => (
            <option key={headingLevel} value={headingLevel}>
              H{headingLevel}
            </option>
          ))}
        </select>
        <select
          className="editor-toolbar-select editor-font-select"
          aria-label="글꼴 선택"
          value={activeFontFamily}
          onChange={(event) => {
            const selectedFontFamily = event.target.value;
            if (!selectedFontFamily) {
              editor.chain().focus().unsetFontFamily().run();
              return;
            }
            editor.chain().focus().setFontFamily(selectedFontFamily).run();
          }}
        >
          <option value="">기본 글꼴</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Courier New">Courier New</option>
          <option value="Pretendard">Pretendard</option>
        </select>
        <select
          className="editor-toolbar-select editor-font-size-select"
          aria-label="글자 크기 선택"
          value={activeFontSize}
          onChange={(event) => {
            const selectedFontSize = event.target.value;
            if (!selectedFontSize) {
              editor.chain().focus().unsetFontSize().run();
              return;
            }
            if (isSupportedFontSize(selectedFontSize)) {
              editor.chain().focus().setFontSize(selectedFontSize).run();
            }
          }}
        >
          <option value="">기본 크기</option>
          {FONT_SIZE_OPTIONS.map((fontSize) => (
            <option key={fontSize} value={fontSize}>{fontSize}</option>
          ))}
        </select>
      </div>

      {/* ④ 글머리·번호·체크 목록과 들여쓰기(목록 안에서만 동작) */}
      <div className="editor-toolbar-group" role="group" aria-label="목록과 들여쓰기">
        <ToolbarButton
          label="글머리 목록"
          active={editor.isActive("bulletList")}
          handleClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ☷
        </ToolbarButton>
        <ToolbarButton
          label="번호 목록"
          active={editor.isActive("orderedList")}
          handleClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          label="할 일 목록"
          active={editor.isActive("taskList")}
          handleClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          ☑
        </ToolbarButton>
        <ToolbarButton
          label="내어쓰기"
          disabled={!editor.can().chain().focus().liftListItem(activeListItemType).run()}
          handleClick={() => editor.chain().focus().liftListItem(activeListItemType).run()}
        >
          ⇤
        </ToolbarButton>
        <ToolbarButton
          label="들여쓰기"
          disabled={!editor.can().chain().focus().sinkListItem(activeListItemType).run()}
          handleClick={() => editor.chain().focus().sinkListItem(activeListItemType).run()}
        >
          ⇥
        </ToolbarButton>
      </div>

      {/* ⑤ 굵게·기울임·밑줄·취소선, 글자색·형광펜 */}
      <div className="editor-toolbar-group" role="group" aria-label="글자 스타일">
        <ToolbarButton
          label="굵게"
          active={editor.isActive("bold")}
          extraClassName="editor-tool-bold"
          handleClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          label="기울임"
          active={editor.isActive("italic")}
          extraClassName="editor-tool-italic"
          handleClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          label="취소선"
          active={editor.isActive("strike")}
          extraClassName="editor-tool-strike"
          handleClick={() => editor.chain().focus().toggleStrike().run()}
        >
          S
        </ToolbarButton>
        <ToolbarButton
          label="밑줄"
          active={editor.isActive("underline")}
          extraClassName="editor-tool-underline"
          handleClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </ToolbarButton>
        <ToolbarButton
          label="인라인 코드"
          active={editor.isActive("code")}
          handleClick={() => editor.chain().focus().toggleCode().run()}
        >
          &lt;/&gt;
        </ToolbarButton>
        <details className="editor-toolbar-menu">
          <summary
            className="editor-tool-button"
            aria-label="글자색과 형광펜"
            title="글자색과 형광펜"
          >
            A
          </summary>
          <div className="editor-toolbar-menu-panel editor-color-menu-panel">
            <label>
              <span>글자색</span>
              <input
                type="color"
                value={textColor}
                onChange={(event) => {
                  setTextColor(event.target.value);
                  editor.chain().focus().setColor(event.target.value).run();
                }}
              />
            </label>
            <button
              type="button"
              onClick={(event) => {
                editor.chain().focus().unsetColor().run();
                closeToolbarMenu(event);
              }}
            >
              글자색 해제
            </button>
            <label>
              <span>형광펜</span>
              <input
                type="color"
                value={highlightColor}
                onChange={(event) => {
                  setHighlightColor(event.target.value);
                  editor.chain().focus().toggleHighlight({ color: event.target.value }).run();
                }}
              />
            </label>
            <button
              type="button"
              onClick={(event) => {
                editor.chain().focus().unsetHighlight().run();
                closeToolbarMenu(event);
              }}
            >
              형광펜 해제
            </button>
          </div>
        </details>
      </div>

      {/* ⑥ 왼쪽·가운데·오른쪽·양쪽 정렬 */}
      <div className="editor-toolbar-group" role="group" aria-label="문단 정렬">
        {(["left", "center", "right", "justify"] as const).map((alignment) => {
          const alignmentLabel = {
            left: "왼쪽 정렬",
            center: "가운데 정렬",
            right: "오른쪽 정렬",
            justify: "양쪽 정렬",
          }[alignment];
          return (
            <ToolbarButton
              key={alignment}
              label={alignmentLabel}
              active={editor.isActive({ textAlign: alignment })}
              handleClick={() => editor.chain().focus().setTextAlign(alignment).run()}
            >
              <AlignmentIcon alignment={alignment} />
            </ToolbarButton>
          );
        })}
      </div>

      {/* ⑦ 링크(주소 검사는 editorLink.ts), 이미지 업로드 */}
      <div className="editor-toolbar-group" role="group" aria-label="링크와 미디어">
        <ToolbarButton
          label="링크 설정"
          active={editor.isActive("link")}
          handleClick={handleLinkSetting}
        >
          ↗
        </ToolbarButton>
        <ToolbarButton
          label="링크 해제"
          disabled={!editor.isActive("link")}
          handleClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          ×↗
        </ToolbarButton>
        <ToolbarButton
          label={isImageUploading ? "이미지 업로드 중" : "이미지 넣기"}
          disabled={isImageUploading}
          handleClick={handleImageButtonClick}
        >
          {isImageUploading ? "…" : "▧"}
        </ToolbarButton>
      </div>

      {/* ⑧ 표 삽입·편집 메뉴(RichTextTableMenu) */}
      <div className="editor-toolbar-group" role="group" aria-label="표 삽입 및 편집">
        <RichTextTableMenu editor={editor} isInsideTable={isInsideTable} />
      </div>

      {/* ⑨ 자주 쓰지 않는 서식은 "더 보기" 메뉴에 모아 도구 모음이 넘치지 않게 한다. */}
      <div className="editor-toolbar-group" role="group" aria-label="추가 서식">
        <details className="editor-toolbar-menu editor-toolbar-more-menu">
          <summary className="editor-tool-button" aria-label="서식 더보기" title="서식 더보기">
            ⋯
          </summary>
          <div className="editor-toolbar-menu-panel editor-more-menu-panel">
            <button
              type="button"
              className={editor.isActive("blockquote") ? "active" : ""}
              onClick={(event) => {
                editor.chain().focus().toggleBlockquote().run();
                closeToolbarMenu(event);
              }}
            >
              인용문
            </button>
            <button
              type="button"
              className={editor.isActive("codeBlock") ? "active" : ""}
              onClick={(event) => {
                editor.chain().focus().toggleCodeBlock().run();
                closeToolbarMenu(event);
              }}
            >
              코드 블록
            </button>
            <button
              type="button"
              className={editor.isActive("subscript") ? "active" : ""}
              onClick={(event) => {
                editor.chain().focus().toggleSubscript().run();
                closeToolbarMenu(event);
              }}
            >
              아래 첨자 X₂
            </button>
            <button
              type="button"
              className={editor.isActive("superscript") ? "active" : ""}
              onClick={(event) => {
                editor.chain().focus().toggleSuperscript().run();
                closeToolbarMenu(event);
              }}
            >
              위 첨자 X²
            </button>
            <button
              type="button"
              onClick={(event) => {
                editor.chain().focus().setHorizontalRule().run();
                closeToolbarMenu(event);
              }}
            >
              가로선
            </button>
            <button
              type="button"
              onClick={(event) => {
                editor.chain().focus().setHardBreak().run();
                closeToolbarMenu(event);
              }}
            >
              강제 줄바꿈
            </button>
            <button
              type="button"
              onClick={(event) => {
                editor.chain().focus().unsetAllMarks().clearNodes().run();
                closeToolbarMenu(event);
              }}
            >
              서식 지우기
            </button>
          </div>
        </details>
      </div>
    </div>
  );
};
