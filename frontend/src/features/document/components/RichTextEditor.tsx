import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadEditorImage } from "@/features/file/api/fileApi";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import type { FileUploadResponse } from "@/features/file/types/fileTypes";

interface RichTextEditorProperties {
  initialContent?: JSONContent;
  editorLabel?: string;
  imageUploadFunction?: (imageFile: File) => Promise<FileUploadResponse & { contentUrl: string }>;
  handleImageUploaded?: (thumbnailFileId: number, thumbnailImageUrl: string) => void;
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
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "문서 내용을 입력하세요." }),
    ],
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      handlePaste: (_editorView, clipboardEvent) => {
        const imageFile = Array.from(clipboardEvent.clipboardData?.files ?? []).find((file) =>
          file.type.startsWith("image/"),
        );
        if (!imageFile) {
          return false;
        }
        void handleImageUpload(imageFile);
        return true;
      },
      handleDrop: (_editorView, dragEvent) => {
        const imageFile = Array.from(dragEvent.dataTransfer?.files ?? []).find((file) =>
          file.type.startsWith("image/"),
        );
        if (!imageFile) {
          return false;
        }
        dragEvent.preventDefault();
        void handleImageUpload(imageFile);
        return true;
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      handleContentChange({
        contentJson: updatedEditor.getJSON(),
        contentHtml: updatedEditor.getHTML(),
        contentText: updatedEditor.getText(),
      });
    },
  });

  useEffect(() => {
    if (editor && initialContent && editor.isEmpty) {
      editor.commands.setContent(initialContent, false);
    }
  }, [editor, initialContent]);

  const handleImageUpload = async (imageFile: File): Promise<void> => {
    if (!imageFile.type.startsWith("image/")) {
      applicationNotification.warning("이미지 파일만 본문에 넣을 수 있습니다.");
      return;
    }
    setImageUploading(true);
    try {
      const uploadedFile = await imageUploadFunction(imageFile);
      editor?.chain().focus().setImage({ src: uploadedFile.contentUrl, alt: imageFile.name }).run();
      handleImageUploaded?.(uploadedFile.fileId, uploadedFile.contentUrl);
      applicationNotification.success("이미지를 업로드했습니다.");
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      setImageUploading(false);
      if (imageInputReference.current) imageInputReference.current.value = "";
    }
  };

  if (!editor) {
    return <div className="editor-loading">에디터를 준비하고 있습니다.</div>;
  }

  return (
    <div className="editor-container">
      <div className="editor-heading-row">
        <strong>{editorLabel}</strong>
        <button type="button" className="ghost-button" onClick={() => imageInputReference.current?.click()} disabled={isImageUploading}>
          {isImageUploading ? "이미지 업로드 중..." : "이미지 넣기"}
        </button>
        <input
          ref={imageInputReference}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) void handleImageUpload(selectedFile);
          }}
        />
      </div>
      <div className="editor-toolbar" role="toolbar" aria-label={`${editorLabel} 서식`}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          굵게
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          기울임
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          목록
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          코드
        </button>
      </div>
      <EditorContent editor={editor} className="editor-content" />
      <p className="editor-help-text">
        이미지 선택, Ctrl+V 붙여넣기 또는 드래그로 이미지를 추가할 수 있습니다.
      </p>
    </div>
  );
};
