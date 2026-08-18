/**
 * ============================================================================
 * GalleryPracticePage.tsx — 【중급】 이미지 파일 다루기 + 보기 모드 전환
 * ============================================================================
 *
 * [이 페이지에서만 배우는 것 — 파일 입력]
 *   지금까지는 글자와 숫자만 다뤘다. 여기서는 브라우저의 파일을 다룬다.
 *
 *   ★ <input type="file">은 다른 input과 결정적으로 다르다.
 *     value로 값을 지정할 수 없다! (보안상 브라우저가 막아 뒀다)
 *     코드로 "이 파일을 선택된 상태로 만들어라"가 불가능하다.
 *     악성 사이트가 몰래 사용자 파일을 지정해 업로드하는 걸 막기 위해서다.
 *
 *     그래서 제어 컴포넌트 방식을 쓸 수 없고, useRef로 DOM을 직접 잡아
 *     .value = "" 로 비우는 방법을 쓴다. (아래 resetForm 참고)
 *
 * [배울 개념]
 *   useRef로 DOM 조작 / FileReader로 이미지 미리보기 / data URL
 *   / 파일 종류·크기 검증 / 같은 데이터를 두 가지 방식(카드/표)으로 보여주기
 */

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

// 목록을 카드로 볼지 표로 볼지.
type GalleryViewMode = "CARD" | "TABLE";

interface GalleryItem {
  galleryId: number;
  title: string;
  description: string;

  // ★ data URL 형태로 이미지를 통째로 담는다.
  //   "data:image/png;base64,iVBORw0KGgo..." 처럼 이미지 전체가 글자로 인코딩된 값이다.
  //
  //   장점: 서버 없이도 이미지를 화면에 띄울 수 있다 (연습에 딱 맞다)
  //   단점: 문자열이 엄청나게 길어져서 메모리를 많이 먹는다
  //         (원본보다 약 33% 커진다)
  //
  //   실무에서는 파일을 서버에 올리고 "https://.../abc.jpg" 같은 주소만 저장한다.
  //   진짜 업로드 방식은 features/file/api/fileApi.ts와
  //   features/file/components/ThumbnailImageUploader.tsx에 주석과 함께 정리해 뒀다.
  //   (파일을 먼저 올려 fileId를 받고, 그 번호만 저장하는 흐름)
  imageDataUrl: string;

  originalFileName: string;
  createdAt: string;
}

/**
 * 샘플용 이미지를 코드로 그려서 만든다.
 *
 * ★ 왜 이런 걸 만들었을까?
 *   샘플 이미지 파일을 프로젝트에 넣으면 저장소 용량이 커지고,
 *   경로가 틀어지면 깨진 이미지가 뜬다.
 *   SVG는 그냥 글자(마크업)라서 코드로 만들 수 있고, 확대해도 안 깨진다.
 *
 * 마지막 줄의 변환 과정:
 *   `data:image/svg+xml;charset=UTF-8,` + 인코딩된 SVG
 *   → 이렇게 만들면 <img src="이것"> 으로 바로 쓸 수 있다.
 *   encodeURIComponent가 필요한 이유는 SVG 안의 #, <, > 같은 글자가
 *   URL에서 특별한 의미를 가져서 그대로 두면 깨지기 때문이다.
 */
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
  // ★ 파일 입력창의 DOM을 직접 잡기 위한 ref.
  //   앞서 말했듯 <input type="file">은 value를 코드로 지정할 수 없다.
  //   하지만 DOM에 직접 접근하면 .value = "" 로 "비우는 것"은 가능하다.
  //   (비우는 건 보안 위험이 없어서 허용된다)
  //   이걸 안 하면 같은 파일을 다시 선택했을 때 onChange가 안 터진다.
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

  /**
   * ★★ 파일을 선택했을 때 미리보기를 만드는 함수. 이 페이지의 핵심이다.
   *
   * 흐름: 파일 선택 → 검증 → FileReader로 읽기 → data URL을 State에 저장 → <img>에 표시
   */
  const readImageFile = (changeEvent: ChangeEvent<HTMLInputElement>): void => {
    // files는 FileList(파일 목록)다. multiple 속성이 없으면 최대 하나만 들어온다.
    // `?.[0]` 로 안전하게 첫 번째를 꺼낸다. 취소를 누르면 목록이 비어서 undefined가 된다.
    const selectedFile = changeEvent.target.files?.[0];
    if (!selectedFile) return;

    // ── 검증 1: 이미지 파일인가? ──
    // file.type은 "image/png", "image/jpeg" 같은 MIME 타입이다.
    // startsWith("image/")로 이미지 계열인지만 확인한다.
    //
    // ★ 파일 이름의 확장자(.png)로 검사하면 안 되나?
    //   이름은 아무렇게나 바꿀 수 있다. virus.exe를 photo.png로 이름만 바꿀 수 있다.
    //   MIME 타입 검사가 그보다 낫지만 이것도 완벽하진 않다.
    //   ★ 진짜 방어는 항상 서버에서 해야 한다. 프론트 검증은 사용자 편의일 뿐이다.
    if (!selectedFile.type.startsWith("image/")) {
      applicationNotification.warning("이미지 파일만 선택할 수 있습니다.");
      // 잘못된 파일이 선택된 채로 남지 않도록 입력창을 비운다.
      changeEvent.target.value = "";
      return;
    }

    // ── 검증 2: 크기가 적당한가? ──
    // 3 * 1024 * 1024 = 3,145,728 바이트 = 3MB.
    // 그냥 3145728이라고 쓰는 것보다 "3MB"임이 한눈에 보인다.
    //
    // 큰 파일을 data URL로 만들면 문자열이 수백만 글자가 되어
    // 브라우저가 버벅이거나 멈출 수 있다. 그래서 미리 막는다.
    if (selectedFile.size > 3 * 1024 * 1024) {
      applicationNotification.warning("학습 화면에서는 3MB 이하 이미지만 선택해 주세요.");
      changeEvent.target.value = "";
      return;
    }

    // ── FileReader로 파일 읽기 ──
    // 파일 읽기는 시간이 걸리는 비동기 작업이다.
    // 다 읽을 때까지 기다리는 게 아니라, "다 읽으면 이걸 해라"고 미리 등록해 둔다.
    //
    // ★ 이건 Promise가 아니라 옛날 방식의 이벤트 콜백이다.
    //   FileReader가 Promise보다 먼저 만들어진 API라서 그렇다.
    //   await로 기다릴 수 없고, onload/onerror에 함수를 붙여 둬야 한다.
    const fileReader = new FileReader();

    // 읽기 성공 시 실행된다.
    fileReader.onload = () => {
      // result는 string 또는 ArrayBuffer 타입이다.
      // readAsDataURL로 읽으면 항상 string이지만,
      // TypeScript는 그걸 모르므로 확인해 줘야 안전하게 쓸 수 있다.
      if (typeof fileReader.result !== "string") return;
      setSelectedImageDataUrl(fileReader.result);
      setSelectedFileName(selectedFile.name);
    };

    // 읽기 실패 시 실행된다. (파일이 손상됐거나 권한 문제 등)
    fileReader.onerror = () => applicationNotification.error("이미지 미리보기를 만들지 못했습니다.");

    // ★ 여기가 실제로 읽기를 "시작"하는 지점이다.
    //   위 onload/onerror는 준비만 해 둔 것이고, 이 줄이 있어야 실행된다.
    //   readAsDataURL은 파일을 "data:image/png;base64,..." 형태로 읽어 준다.
    fileReader.readAsDataURL(selectedFile);
  };

  /** 폼을 초기 상태로 되돌린다. */
  const resetForm = (): void => {
    setTitle("");
    setDescription("");
    setSelectedFileName("");
    setSelectedImageDataUrl("");
    setEditingGalleryId(null);

    // ★★ 파일 입력창은 State로 비울 수 없어서 DOM을 직접 비운다.
    //
    //   이걸 빼먹으면 이런 버그가 난다:
    //     1) cat.png를 선택했다가 등록한다
    //     2) 다시 cat.png를 선택한다
    //     3) → onChange가 안 터진다! 입력창 입장에서는 "값이 안 바뀌었으니까".
    //
    //   .value = "" 로 비워 두면 같은 파일을 골라도 "바뀐 것"으로 인식된다.
    //   `if (...current)` 확인은 ref가 아직 연결 안 됐을 수 있어서 넣는다.
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

  /** 수정 모드로 전환하며 폼에 기존 값을 채운다. */
  const startUpdate = (galleryItem: GalleryItem): void => {
    setEditingGalleryId(galleryItem.galleryId);
    setTitle(galleryItem.title);
    setDescription(galleryItem.description);
    setSelectedImageDataUrl(galleryItem.imageDataUrl);
    setSelectedFileName(galleryItem.originalFileName);

    // ★ 화면을 맨 위로 부드럽게 올린다.
    //   폼은 화면 위쪽에 있는데 목록 아래쪽에서 수정 버튼을 누르면
    //   폼이 보이지 않아 "눌렀는데 아무 일도 안 일어나네?" 하고 오해한다.
    //   이런 작은 배려가 사용자 경험을 크게 좌우한다.
    //
    //   behavior: "smooth" → 순간이동이 아니라 스르륵 스크롤된다.
    //   사용자가 화면이 이동했다는 걸 인지할 수 있어 덜 당황스럽다.
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
          {/* 파일 선택 입력창.
                ref     : 위에서 만든 상자와 연결한다 (비우기 위해 필요)
                accept  : 파일 선택 창에서 이미지만 보이게 필터링한다
                          ★ 어디까지나 편의 기능이다. "모든 파일"을 골라 우회할 수 있으므로
                            readImageFile 안의 실제 검증이 반드시 필요하다.
                value   : 없다! 이 input만은 제어 컴포넌트로 만들 수 없다. */}
          <label>이미지 파일<input ref={fileInputReference} type="file" accept="image/*" onChange={readImageFile} /></label>

          {/* 미리보기 영역.
              ★ 이미지가 없을 때 안내 문구를 넣은 점에 주목.
                빈 네모만 덩그러니 있으면 사용자는 "여기 뭐가 있어야 하나?" 하고 헷갈린다.
              ★ alt 속성은 이미지가 안 뜰 때 대신 나오고 화면 낭독기가 읽는다. 필수다. */}
          <div className="gallery-upload-preview">{selectedImageDataUrl ? <img src={selectedImageDataUrl} alt="선택한 이미지 미리보기" /> : <span>이미지를 선택하면 미리보기가 나타납니다.</span>}</div>
          <div className="button-row"><button type="button" onClick={saveGalleryItem}>{editingGalleryId ? "수정 저장" : "이미지 등록"}</button>{editingGalleryId ? <button type="button" className="ghost-button" onClick={resetForm}>수정 취소</button> : null}</div>
        </article>

        <div>
          <label className="search-field">이미지 제목 검색<input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} /></label>
          {/* ★ 같은 데이터를 두 가지 방식으로 보여준다.
                카드 = 이미지가 크게 보여서 훑어보기 좋다
                표   = 정보 밀도가 높아 파일명·날짜 비교에 좋다
              데이터는 하나(visibleGalleryItems)이고 표현만 다르다.
              "데이터와 표현의 분리"를 잘 보여주는 예다.

              ★ 참고: 아래 <img>에 loading="lazy"가 붙어 있다.
                화면에 보이기 직전까지 이미지를 안 받는 브라우저 기본 기능이다.
                이미지가 많은 갤러리에서 첫 로딩 속도를 크게 줄여 준다. */}
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
