import { useEffect, useState } from "react";
import type { Snippet, SnippetSaveRequest } from "@/features/utility/types/snippetTypes";

interface SnippetEditorProps {
  snippet?: Snippet;
  pending: boolean;
  onCancel: () => void;
  onSave: (request: SnippetSaveRequest) => void;
}

const languages = ["JavaScript", "TypeScript", "Java", "Kotlin", "SQL", "HTML", "CSS", "JSON", "YAML", "Bash", "PowerShell", "Other"];

export const SnippetEditor = ({ snippet, pending, onCancel, onSave }: SnippetEditorProps) => {
  const [title, setTitle] = useState(snippet?.title ?? "");
  const [description, setDescription] = useState(snippet?.description ?? "");
  const [language, setLanguage] = useState(snippet?.language ?? "TypeScript");
  const [code, setCode] = useState(snippet?.code ?? "");
  const [tags, setTags] = useState(snippet?.tags.join(", ") ?? "");
  const [favorite, setFavorite] = useState(snippet?.favorite ?? false);

  useEffect(() => { document.getElementById("snippet-title")?.focus(); }, []);
  const normalizedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const invalid = !title.trim() || !code.trim() || normalizedTags.length > 10;

  return (
    <section className="snippet-editor-panel" aria-label={snippet ? "코드 조각 수정" : "코드 조각 등록"}>
      <header><div><h2>{snippet ? "코드 조각 수정" : "새 코드 조각"}</h2><p>코드는 로그인한 현재 회원에게만 저장됩니다.</p></div><button type="button" className="ghost-button" onClick={onCancel}>닫기</button></header>
      <div className="snippet-editor-fields"><label>제목<input id="snippet-title" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>언어<select value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((item) => <option key={item}>{item}</option>)}</select></label><label className="snippet-description-field">설명<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="snippet-tags-field">태그 · 쉼표로 구분<input value={tags} placeholder="react, query, api" onChange={(event) => setTags(event.target.value)} /><small>{normalizedTags.length}/10개</small></label><label className="checkbox-label snippet-favorite-field"><input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />즐겨찾기</label><label className="snippet-code-field">코드<textarea maxLength={200_000} value={code} spellCheck={false} onChange={(event) => setCode(event.target.value)} /></label></div>
      {normalizedTags.length > 10 ? <p className="field-error">태그는 최대 10개까지 저장할 수 있습니다.</p> : null}
      <footer><span>{code.length.toLocaleString("ko-KR")} / 200,000자</span><button type="button" className="ghost-button" onClick={onCancel}>취소</button><button type="button" disabled={invalid || pending} onClick={() => onSave({ title: title.trim(), description: description.trim(), language, code, tags: normalizedTags, favorite })}>{pending ? "저장 중…" : "저장"}</button></footer>
    </section>
  );
};

