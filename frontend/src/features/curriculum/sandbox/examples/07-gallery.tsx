/**
 * 7단계 연습 — 이미지 갤러리: 파일 선택, FileReader 미리보기, 카드/표 보기 전환
 *
 * 해 볼 것
 *  1. 파일 입력에 multiple을 붙이고 여러 장을 한 번에 추가해 보세요.
 *  2. 5MB가 넘는 파일은 거절하고 안내 문구를 보여 주세요.
 */
import { useState, type ChangeEvent } from "react";

interface GalleryItem { id: number; title: string; imageUrl: string; }

export default function App() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [viewMode, setViewMode] = useState<"CARD" | "TABLE">("CARD");
  const [message, setMessage] = useState("");

  const readImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("이미지 파일만 올릴 수 있습니다."); return; }
    // FileReader: 파일을 브라우저 안에서 읽어 data URL(문자열)로 바꾼다. 서버 업로드 없이 미리보기 가능.
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const imageUrl = reader.result;
      setItems((previous) => [...previous, { id: Date.now(), title: file.name, imageUrl }]);
      setMessage(`${file.name}을(를) 추가했습니다.`);
    };
    reader.readAsDataURL(file);
    // 같은 파일을 다시 골라도 onChange가 일어나도록 입력값을 비운다.
    event.target.value = "";
  };

  return (
    <main>
      <h1>이미지 갤러리</h1>
      <div className="row">
        <input type="file" accept="image/*" onChange={readImage} aria-label="이미지 선택" />
        <button className="secondary" onClick={() => setViewMode(viewMode === "CARD" ? "TABLE" : "CARD")}>
          {viewMode === "CARD" ? "표로 보기" : "카드로 보기"}
        </button>
      </div>
      {message ? <p className="ok" role="status">{message}</p> : null}
      {items.length === 0 ? <p className="muted">이미지를 선택해 보세요.</p> : null}

      {viewMode === "CARD" ? (
        <div className="row">
          {items.map((item) => (
            <figure key={item.id} className="card" style={{ width: 160, margin: 0 }}>
              <img src={item.imageUrl} alt={item.title} style={{ width: "100%", height: 100, objectFit: "cover" }} />
              <figcaption className="muted">{item.title}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <table>
          <thead><tr><th>미리보기</th><th>파일명</th><th>관리</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {/* 옆 칸에 파일명이 있으므로 이 이미지는 장식 → alt="" */}
                <td><img src={item.imageUrl} alt="" style={{ width: 60 }} /></td>
                <td>{item.title}</td>
                <td><button className="danger" onClick={() => setItems((previous) => previous.filter((current) => current.id !== item.id))}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
