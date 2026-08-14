import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

type GalleryViewMode = "CARD" | "TABLE";

interface GalleryItem {
  galleryId: number;
  title: string;
  description: string;
  imageDataUrl: string;
  originalFileName: string;
  createdAt: string;
}

const createPlaceholderImage = (label: string, firstColor: string, secondColor: string): string => {
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${firstColor}"/><stop offset="1" stop-color="${secondColor}"/></linearGradient></defs><rect width="900" height="540" rx="32" fill="url(#g)"/><circle cx="715" cy="140" r="70" fill="rgba(255,255,255,.22)"/><path d="M0 430L235 230L390 350L540 190L900 500V540H0Z" fill="rgba(255,255,255,.3)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="52" font-family="sans-serif" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
};

const initialGalleryItems: GalleryItem[] = [
  { galleryId: 1, title: "React 카드 레이아웃", description: "썸네일 카드 목록 연습용 이미지입니다.", imageDataUrl: createPlaceholderImage("React Gallery", "#315efb", "#8257e6"), originalFileName: "react-gallery.svg", createdAt: "2026-08-04" },
  { galleryId: 2, title: "Spring API 흐름", description: "프론트와 백엔드 연결 흐름을 표현합니다.", imageDataUrl: createPlaceholderImage("Spring API", "#16875b", "#61b15a"), originalFileName: "spring-api.svg", createdAt: "2026-08-05" },
  { galleryId: 3, title: "Docker 실행 환경", description: "컨테이너 실행 연습용 대표 이미지입니다.", imageDataUrl: createPlaceholderImage("Docker", "#1769aa", "#37a8e6"), originalFileName: "docker.svg", createdAt: "2026-08-06" },
];

export const GalleryPracticePage = () => {
  const fileInputReference = useRef<HTMLInputElement>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(initialGalleryItems);
  const [viewMode, setViewMode] = useState<GalleryViewMode>("CARD");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState("");
  const [editingGalleryId, setEditingGalleryId] = useState<number | null>(null);
  const [previewGalleryItem, setPreviewGalleryItem] = useState<GalleryItem | null>(null);
  const [deleteTargetGalleryItem, setDeleteTargetGalleryItem] = useState<GalleryItem | null>(null);

  const visibleGalleryItems = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
    return galleryItems.filter((galleryItem) => galleryItem.title.toLowerCase().includes(normalizedSearchKeyword));
  }, [galleryItems, searchKeyword]);

  const readImageFile = (changeEvent: ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = changeEvent.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      applicationNotification.warning("이미지 파일만 선택할 수 있습니다.");
      changeEvent.target.value = "";
      return;
    }
    if (selectedFile.size > 3 * 1024 * 1024) {
      applicationNotification.warning("학습 화면에서는 3MB 이하 이미지만 선택해 주세요.");
      changeEvent.target.value = "";
      return;
    }
    const fileReader = new FileReader();
    fileReader.onload = () => {
      if (typeof fileReader.result !== "string") return;
      setSelectedImageDataUrl(fileReader.result);
      setSelectedFileName(selectedFile.name);
    };
    fileReader.onerror = () => applicationNotification.error("이미지 미리보기를 만들지 못했습니다.");
    fileReader.readAsDataURL(selectedFile);
  };

  const resetForm = (): void => {
    setTitle("");
    setDescription("");
    setSelectedFileName("");
    setSelectedImageDataUrl("");
    setEditingGalleryId(null);
    if (fileInputReference.current) fileInputReference.current.value = "";
  };

  const saveGalleryItem = (): void => {
    if (!title.trim() || !selectedImageDataUrl) {
      applicationNotification.warning("제목과 이미지를 선택해 주세요.");
      return;
    }
    const currentDate = new Date().toISOString().slice(0, 10);
    if (editingGalleryId === null) {
      setGalleryItems((previousGalleryItems) => [{ galleryId: Date.now(), title: title.trim(), description: description.trim(), imageDataUrl: selectedImageDataUrl, originalFileName: selectedFileName, createdAt: currentDate }, ...previousGalleryItems]);
      applicationNotification.success("이미지 게시글을 등록했습니다.");
    } else {
      setGalleryItems((previousGalleryItems) => previousGalleryItems.map((galleryItem) => galleryItem.galleryId === editingGalleryId ? { ...galleryItem, title: title.trim(), description: description.trim(), imageDataUrl: selectedImageDataUrl, originalFileName: selectedFileName || galleryItem.originalFileName } : galleryItem));
      applicationNotification.success("이미지 게시글을 수정했습니다.");
    }
    resetForm();
  };

  const startUpdate = (galleryItem: GalleryItem): void => {
    setEditingGalleryId(galleryItem.galleryId);
    setTitle(galleryItem.title);
    setDescription(galleryItem.description);
    setSelectedImageDataUrl(galleryItem.imageDataUrl);
    setSelectedFileName(galleryItem.originalFileName);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteGalleryItem = (): void => {
    if (!deleteTargetGalleryItem) return;
    setGalleryItems((previousGalleryItems) => previousGalleryItems.filter((galleryItem) => galleryItem.galleryId !== deleteTargetGalleryItem.galleryId));
    applicationNotification.success("이미지 게시글을 삭제했습니다.");
    setDeleteTargetGalleryItem(null);
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-중급">중급 · 난이도 6/10</span><h1>이미지 갤러리 게시판</h1><p>업로드한 이미지를 카드 썸네일과 표 목록으로 전환하고 미리보기·수정·삭제합니다.</p></div><div className="segmented-control"><button type="button" className={viewMode === "CARD" ? "active" : ""} onClick={() => setViewMode("CARD")}>썸네일</button><button type="button" className={viewMode === "TABLE" ? "active" : ""} onClick={() => setViewMode("TABLE")}>표</button></div></div>

      <div className="split-practice-layout gallery-practice-layout">
        <article className="practice-card sticky-form-card">
          <h2>{editingGalleryId ? "이미지 게시글 수정" : "이미지 게시글 추가"}</h2>
          <label>제목<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="이미지 제목" /></label>
          <label>설명<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label>
          <label>이미지 파일<input ref={fileInputReference} type="file" accept="image/*" onChange={readImageFile} /></label>
          <div className="gallery-upload-preview">{selectedImageDataUrl ? <img src={selectedImageDataUrl} alt="선택한 이미지 미리보기" /> : <span>이미지를 선택하면 미리보기가 나타납니다.</span>}</div>
          <div className="button-row"><button type="button" onClick={saveGalleryItem}>{editingGalleryId ? "수정 저장" : "이미지 등록"}</button>{editingGalleryId ? <button type="button" className="ghost-button" onClick={resetForm}>수정 취소</button> : null}</div>
        </article>

        <div>
          <label className="search-field">이미지 제목 검색<input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} /></label>
          {viewMode === "CARD" ? (
            <div className="gallery-card-grid">{visibleGalleryItems.map((galleryItem) => <article className="gallery-card" key={galleryItem.galleryId}><button type="button" className="gallery-image-button" onClick={() => setPreviewGalleryItem(galleryItem)}><img loading="lazy" src={galleryItem.imageDataUrl} alt={galleryItem.title} /></button><div className="gallery-card-content"><h2>{galleryItem.title}</h2><p>{galleryItem.description || "설명 없음"}</p><small>{galleryItem.originalFileName} · {galleryItem.createdAt}</small><div className="button-row compact-button-row"><button type="button" className="secondary-button" onClick={() => startUpdate(galleryItem)}>수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetGalleryItem(galleryItem)}>삭제</button></div></div></article>)}</div>
          ) : (
            <div className="table-wrapper"><table><thead><tr><th>썸네일</th><th>제목</th><th>파일명</th><th>등록일</th><th>관리</th></tr></thead><tbody>{visibleGalleryItems.map((galleryItem) => <tr key={galleryItem.galleryId}><td><button type="button" className="table-thumbnail-button" onClick={() => setPreviewGalleryItem(galleryItem)}><img src={galleryItem.imageDataUrl} alt="" /></button></td><td>{galleryItem.title}</td><td>{galleryItem.originalFileName}</td><td>{galleryItem.createdAt}</td><td><div className="button-row compact-button-row"><button type="button" className="secondary-button" onClick={() => startUpdate(galleryItem)}>수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetGalleryItem(galleryItem)}>삭제</button></div></td></tr>)}</tbody></table></div>
          )}
          {visibleGalleryItems.length === 0 ? <div className="state-panel">검색 결과가 없습니다.</div> : null}
        </div>
      </div>

      <ModalDialog isOpen={previewGalleryItem !== null} title={previewGalleryItem?.title ?? "이미지 미리보기"} description={previewGalleryItem?.description} onRequestClose={() => setPreviewGalleryItem(null)} footer={<button type="button" onClick={() => setPreviewGalleryItem(null)}>닫기</button>}><div className="gallery-preview-modal">{previewGalleryItem ? <img src={previewGalleryItem.imageDataUrl} alt={previewGalleryItem.title} /> : null}</div></ModalDialog>
      <ConfirmDialog isOpen={deleteTargetGalleryItem !== null} title="이미지 게시글 삭제" description={`“${deleteTargetGalleryItem?.title ?? ""}”을 삭제할까요?`} confirmButtonLabel="삭제" onConfirm={deleteGalleryItem} onCancel={() => setDeleteTargetGalleryItem(null)} />
    </section>
  );
};
