/**
 * ============================================================================
 * RichTextEditor.tsx — 서식 있는 글쓰기 에디터 (Tiptap)
 * ============================================================================
 *
 * [리치 텍스트 에디터란?]
 *   제목, 글자 스타일, 목록, 인용문, 코드, 링크, 이미지 삽입이 되는 글쓰기 창이다.
 *   네이버 블로그나 노션의 편집기를 떠올리면 된다.
 *
 * ★ 절대 직접 만들지 말자.
 *   커서 위치 관리, 실행 취소, 한글 입력(IME) 처리, 복사·붙여넣기,
 *   브라우저별 차이… 제대로 만들려면 수만 줄이 든다.
 *   Tiptap 같은 검증된 라이브러리를 쓰는 게 정답이다.
 *
 * [이 컴포넌트가 하는 일 = "외부 라이브러리를 React에 붙이기"]
 *   Tiptap은 React를 몰라도 동작하는 독립적인 라이브러리다.
 *   그걸 React 컴포넌트로 감싸서 부모가 편히 쓰게 만드는 게 이 파일의 역할이다.
 *   이런 걸 "래퍼(wrapper) 컴포넌트"라고 한다.
 *
 * [배울 개념]
 *   - 라이브러리 훅(useEditor) 사용법
 *   - 붙여넣기·드래그로 이미지 업로드 받기
 *   - 콜백으로 부모에게 변화 알리기
 *   - try/catch/finally로 뒷정리 보장하기
 */

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Table from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { uploadEditorImage } from "@/features/file/api/fileApi";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import type { FileUploadResponse } from "@/features/file/types/fileTypes";
import { normalizeSafeEditorLink } from "@/features/document/utils/editorLink";
import { RichTextEditorToolbar } from "@/features/document/components/RichTextEditorToolbar";
import { FontSizeExtension } from "@/features/document/extensions/fontSize";
import {
  TableCellWithBackground,
  TableHeaderWithBackground,
} from "@/features/document/extensions/tableCellBackground";
import { TableRowWithHeight } from "@/features/document/extensions/tableRowHeight";

interface RichTextEditorProperties {
  initialContent?: JSONContent;
  editorLabel?: string;

  // ★ 이미지 업로드 "함수 자체"를 props로 받을 수 있게 열어 뒀다.
  //   기본값은 실제 업로드 API지만, 필요하면 다른 함수를 끼워 넣을 수 있다.
  //   - 테스트에서 가짜 업로드 함수를 넣어 서버 없이 검사할 수 있다
  //   - 다른 화면에서 다른 업로드 경로를 쓸 수 있다
  //   이런 걸 "의존성 주입"이라고 한다. selectedHttpClient와 같은 발상이다.
  //
  //   `A & B` 는 교차 타입으로 "A와 B의 속성을 모두 가진 타입"이라는 뜻이다.
  imageUploadFunction?: (imageFile: File) => Promise<FileUploadResponse & { contentUrl: string }>;

  // 이미지를 올렸을 때 부모에게 알린다. (부모는 이걸 대표 이미지로 쓸 수 있다)
  // `?`가 붙어 선택 사항이다. 필요 없는 부모는 안 넘겨도 된다.
  handleImageUploaded?: (thumbnailFileId: number, thumbnailImageUrl: string) => void;

  // ★ 내용이 바뀔 때마다 부모에게 알린다. 이건 필수다.
  //   세 가지 형태를 한꺼번에 넘기는 이유는 documentTypes.ts에 설명해 두었다.
  //   (편집용 JSON / 표시용 HTML / 검색용 순수 텍스트)
  handleContentChange: (content: {
    contentJson: JSONContent;
    contentHtml: string;
    contentText: string;
  }) => void;
}

export const RichTextEditor = ({
  initialContent,
  editorLabel = "상세 내용",
  imageUploadFunction = uploadEditorImage,
  handleImageUploaded,
  handleContentChange,
}: RichTextEditorProperties) => {
  const imageInputReference = useRef<HTMLInputElement>(null);
  const [isImageUploading, setImageUploading] = useState(false);
  const [editorZoomPercentage, setEditorZoomPercentage] = useState(100);
  // ── Tiptap 에디터 만들기 ────────────────────────────────────────
  const editor = useEditor({
    // extensions: 에디터에 어떤 기능을 넣을지 고르는 부분.
    // Tiptap은 기본이 텅 비어 있고, 필요한 기능만 조립해서 쓴다.
    extensions: [
      // StarterKit: 굵게/기울임/목록/제목/실행취소 등 기본 세트 묶음.
      StarterKit,
      CharacterCount,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSizeExtension,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      Table.configure({ resizable: true }),
      TableCellWithBackground,
      TableHeaderWithBackground,
      TableRowWithHeight,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Typography,
      Underline,
      // openOnClick: false → 편집 중에 링크를 클릭해도 페이지가 이동하지 않는다.
      // 이게 true면 링크 글자를 수정하려고 클릭했다가 딴 데로 날아간다.
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Image,
      // 내용이 비었을 때 흐리게 보여줄 안내 문구.
      Placeholder.configure({ placeholder: "문서 내용을 입력하세요." }),
    ],

    // 처음 보여줄 내용. 없으면 빈 문단 하나로 시작한다.
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },

    editorProps: {
      // ★ 붙여넣기(Ctrl+V) 가로채기.
      //   클립보드에 이미지가 있으면 자동으로 업로드해 본문에 넣는다.
      //   화면을 캡처해서 바로 붙여넣는 흔한 사용 방식을 지원하는 것이다.
      handlePaste: (_editorView, clipboardEvent) => {
        // clipboardData.files는 배열처럼 생겼지만 진짜 배열이 아니라
        // .find()를 못 쓴다. Array.from()으로 진짜 배열로 바꾼다.
        const imageFile = Array.from(clipboardEvent.clipboardData?.files ?? []).find((file) =>
          file.type.startsWith("image/"),
        );

        // ★ 반환값의 의미가 중요하다.
        //   false → "내가 처리 안 했으니 Tiptap이 기본 동작을 해라" (텍스트 붙여넣기)
        //   true  → "내가 처리했으니 Tiptap은 아무것도 하지 마라"
        if (!imageFile) {
          return false;
        }

        // void를 붙여 "결과를 안 기다린다"고 표시한다.
        // 이 함수는 즉시 true/false를 돌려줘야 해서 await할 수 없다.
        void handleImageUpload(imageFile);
        return true;
      },

      // ★ 드래그 앤 드롭 가로채기. 붙여넣기와 구조가 같다.
      handleDrop: (_editorView, dragEvent) => {
        const imageFile = Array.from(dragEvent.dataTransfer?.files ?? []).find((file) =>
          file.type.startsWith("image/"),
        );
        if (!imageFile) {
          return false;
        }
        // ★ preventDefault()가 꼭 필요하다.
        //   막지 않으면 브라우저가 "그 이미지 파일을 새 탭에서 열어" 버린다.
        //   작성 중이던 글이 통째로 날아가는 사고가 난다.
        dragEvent.preventDefault();
        void handleImageUpload(imageFile);
        return true;
      },
    },

    // ★ 내용이 바뀔 때마다 Tiptap이 불러 주는 함수.
    //   여기서 세 가지 형태를 뽑아 부모에게 넘긴다.
    //     getJSON() → 구조화된 데이터 (다시 편집할 때 씀)
    //     getHTML() → 화면 표시용
    //     getText() → 태그 없는 순수 글자 (검색용)
    //
    //   ※ 글자를 칠 때마다 호출되므로, 여기서 무거운 일을 하면 안 된다.
    //     자동 저장 같은 걸 붙인다면 반드시 디바운스를 걸어야 한다.
    onUpdate: ({ editor: updatedEditor }) => {
      handleContentChange({
        contentJson: updatedEditor.getJSON(),
        contentHtml: updatedEditor.getHTML(),
        contentText: updatedEditor.getText(),
      });
    },
  });

  // ★ 나중에 도착한 데이터를 에디터에 채워 넣기.
  //
  //   [왜 필요한가?]
  //     수정 화면에서는 서버 응답이 늦게 온다.
  //     그런데 위 useEditor의 `content`는 에디터를 만들 때 딱 한 번만 쓰인다.
  //     그래서 나중에 데이터가 와도 저절로 반영되지 않는다.
  //
  //   [`editor.isEmpty` 조건이 핵심이다]
  //     이 조건이 없으면, 사용자가 한창 글을 쓰고 있는데
  //     데이터가 다시 도착해서 작성 중인 내용을 통째로 덮어써 버린다.
  //     "비어 있을 때만 채운다"로 그 사고를 막는다.
  //
  //   setContent의 두 번째 인자 false = "이 변경은 onUpdate를 부르지 마라".
  //   이걸 true로 두면 초기화만 했는데 "내용이 바뀌었다"고 부모에 알려서
  //   저장하지도 않았는데 이탈 방지 경고가 뜬다.
  useEffect(() => {
    if (editor && initialContent && editor.isEmpty) {
      editor.commands.setContent(initialContent, false);
    }
  }, [editor, initialContent]);

  /**
   * 이미지를 서버에 올리고 본문에 삽입한다.
   * 버튼 선택 / 붙여넣기 / 드래그 세 경로가 전부 이 함수로 모인다.
   */
  const handleImageUpload = async (imageFile: File): Promise<void> => {
    if (!imageFile.type.startsWith("image/")) {
      applicationNotification.warning("이미지 파일만 본문에 넣을 수 있습니다.");
      return;
    }

    // 업로드 시작을 표시한다. 버튼이 잠기고 문구가 바뀐다.
    setImageUploading(true);

    try {
      // 서버에 올리고 접근 가능한 주소(contentUrl)를 받는다.
      // ★ GalleryPracticePage와 달리 data URL을 쓰지 않는다.
      //   본문에 이미지 원본을 통째로 넣으면 문서 데이터가 수 메가바이트가 된다.
      //   실무에서는 이렇게 서버에 올리고 "주소만" 본문에 넣는다.
      const uploadedFile = await imageUploadFunction(imageFile);

      // ★ Tiptap의 명령 체이닝 문법.
      //   .chain()으로 시작해 명령을 이어 붙이고 .run()으로 실행한다.
      //     .focus()   → 에디터에 커서를 돌려놓는다 (버튼을 누르면 포커스가 버튼으로 갔으므로)
      //     .setImage()→ 현재 커서 위치에 이미지를 넣는다
      //     .run()     → 여기까지 모은 명령을 실행한다. 이걸 빠뜨리면 아무 일도 안 일어난다!
      //
      //   alt에 파일명을 넣어 두면 이미지가 안 뜰 때 최소한의 설명이 남는다.
      editor?.chain().focus().setImage({ src: uploadedFile.contentUrl, alt: imageFile.name }).run();

      // 부모에게 알린다. `?.`를 붙여 부모가 안 넘겼어도 안전하게 처리한다.
      handleImageUploaded?.(uploadedFile.fileId, uploadedFile.contentUrl);
      applicationNotification.success("이미지를 업로드했습니다.");
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      // ★★ finally는 성공이든 실패든 "무조건" 실행된다.
      //
      //   여기에 뒷정리를 넣는 이유:
      //     이 두 줄을 try 안에만 넣으면, 업로드가 실패했을 때 실행되지 않는다.
      //     그러면 isImageUploading이 true로 영원히 남아
      //     버튼이 "업로드 중..."인 채로 잠겨 버린다. 새로고침 말고는 방법이 없다.
      //
      //   "정리 작업은 finally에" 라는 원칙을 꼭 기억하자.
      setImageUploading(false);
      // 파일 입력창을 비운다. 같은 이미지를 다시 넣을 수 있게 하기 위해서다.
      // (GalleryPracticePage에서 설명한 것과 같은 이유)
      if (imageInputReference.current) imageInputReference.current.value = "";
    }
  };

  // ★ useEditor는 처음 한 순간 null을 돌려줄 수 있다.
  //   그때 아래 JSX를 그리면 에러가 나므로 임시 화면을 보여준다.
  //   이 검사가 있어서 아래 코드에서는 editor가 확실히 있다고 쓸 수 있다.
  if (!editor) {
    return <div className="editor-loading">에디터를 준비하고 있습니다.</div>;
  }

  const handleLinkSetting = (): void => {
    const currentLink = String(editor.getAttributes("link").href ?? "");
    const enteredLink = window.prompt(
      "링크 주소를 입력하세요. 비우면 기존 링크가 제거됩니다.",
      currentLink || "https://",
    );

    if (enteredLink === null) {
      return;
    }

    if (!enteredLink.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    try {
      const safeLink = normalizeSafeEditorLink(enteredLink);
      editor.chain().focus().extendMarkRange("link").setLink({ href: safeLink }).run();
    } catch {
      applicationNotification.warning(
        "http(s), mailto, tel, 내부 경로(/...) 링크만 사용할 수 있습니다.",
      );
    }
  };

  const plainEditorText = editor.getText();
  const editorCharacterCount = Array.from(plainEditorText).length;
  const editorWordCount = plainEditorText.trim() ? plainEditorText.trim().split(/\s+/).length : 0;

  return (
    <div className="editor-container">
      <div className="editor-heading-row">
        <strong>{editorLabel}</strong>
        {/* ★ 숨겨진 파일 입력창. 실무에서 아주 자주 쓰는 요령이다.
              브라우저 기본 파일 선택 UI("파일 선택" 회색 버튼)는 디자인을 바꿀 수 없다.
              그래서 진짜 input은 CSS로 감춰 두고,
              예쁘게 만든 버튼을 눌렀을 때 ref로 그 input을 대신 클릭한다.
                onClick={() => imageInputReference.current?.click()}

            ★ display:none이 아니라 "visually-hidden" 클래스를 쓴 점이 중요하다.
              display:none으로 감추면 키보드로 접근할 수 없어 접근성이 깨진다.
              visually-hidden은 눈에만 안 보이고 기능은 살아 있는 방식이다. */}
        <input
          ref={imageInputReference}
          className="visually-hidden"
          type="file"
          // 허용 형식을 구체적으로 나열했다. image/* 보다 명확하다.
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) void handleImageUpload(selectedFile);
          }}
        />
      </div>
      {/* 서식 도구 모음.
          모든 버튼이 같은 패턴이다: chain() → focus() → 명령() → run()
          focus()를 꼭 넣어야 한다. 버튼을 누르면 포커스가 버튼으로 옮겨 가는데,
          그대로 두면 서식이 어디에 적용될지 몰라 명령이 먹지 않는다.

          role="toolbar" → 화면 낭독기에 "이건 도구 모음"이라고 알린다. */}
      <RichTextEditorToolbar
        editor={editor}
        editorLabel={editorLabel}
        editorZoomPercentage={editorZoomPercentage}
        isImageUploading={isImageUploading}
        handleEditorZoomChange={setEditorZoomPercentage}
        handleImageButtonClick={() => imageInputReference.current?.click()}
        handleLinkSetting={handleLinkSetting}
      />
      {/* ★ 실제 편집 영역이 그려지는 곳.
            Tiptap이 이 자리에 편집 가능한 DOM을 직접 만들어 관리한다.
            즉 이 안쪽은 React가 아니라 Tiptap의 영역이다.
            그래서 여기 내용을 React State로 직접 조작하려 하면 안 되고,
            반드시 editor.commands 같은 Tiptap의 명령을 통해야 한다. */}
      <EditorContent
        editor={editor}
        className="editor-content"
        style={{ fontSize: `${editorZoomPercentage}%` }}
      />
      <p className="editor-help-text">
        이미지 선택, Ctrl+V 붙여넣기 또는 드래그로 이미지를 추가할 수 있습니다. Ctrl+Z와 Ctrl+Y도
        지원합니다. 현재 {editorCharacterCount}자 · {editorWordCount}단어
      </p>
    </div>
  );
};
