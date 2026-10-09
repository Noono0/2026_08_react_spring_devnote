/**
 * 22단계 연습 — URL 상태: 검색·필터·페이지를 주소(쿼리스트링)에 담고, 읽을 때 검증하기
 *
 * 실제 화면은 react-router의 useSearchParams를 쓰지만, 이 편집기에서는 같은 원리를
 * 브라우저 기본 URLSearchParams와 history.replaceState로 보여 준다.
 *
 * 해 볼 것
 *  1. 주소 입력값 칸에 "?category=바나나&page=-3"을 넣고 적용해 보세요. 검증이 기본값으로 바꿔 줍니다.
 *  2. 가격 정렬(sort) 조건을 주소에 추가해 보세요.
 */
import { useState } from "react";

const CATEGORIES = ["전체", "프론트엔드", "백엔드"] as const;
type Category = (typeof CATEGORIES)[number];

// 주소의 값은 누구나 고칠 수 있으므로 "허용 목록"으로 검증한다. 모르면 기본값.
const readCategory = (value: string | null): Category => CATEGORIES.find((category) => category === value) ?? "전체";
const readPage = (value: string | null): number => {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};

const readState = (search: string) => {
  const params = new URLSearchParams(search);
  return { category: readCategory(params.get("category")), page: readPage(params.get("page")) };
};

export default function App() {
  const [search, setSearch] = useState(window.location.search);
  const [typed, setTyped] = useState("");
  const { category, page } = readState(search);

  // 상태를 바꾼다 = 주소를 바꾼다. replaceState는 방문 기록을 늘리지 않고 주소만 바꾼다.
  const update = (changes: Record<string, string>) => {
    const params = new URLSearchParams(search);
    Object.entries(changes).forEach(([key, value]) => params.set(key, value));
    const next = `?${params.toString()}`;
    window.history.replaceState(null, "", next);
    setSearch(next);
  };

  return (
    <main>
      <h1>주소에 담는 상태</h1>
      <p className="muted">현재 주소: <code>{decodeURIComponent(search) || "(없음)"}</code></p>
      <div className="row">
        {CATEGORIES.map((item) => (
          <button key={item} className={item === category ? undefined : "secondary"} onClick={() => update({ category: item, page: "1" })}>{item}</button>
        ))}
      </div>
      <div className="row">
        <button className="secondary" disabled={page === 1} onClick={() => update({ page: String(page - 1) })}>이전</button>
        <span>{page}페이지</span>
        <button className="secondary" onClick={() => update({ page: String(page + 1) })}>다음</button>
      </div>
      <div className="card">
        <label>주소 직접 입력(검증 확인용)<input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="?category=바나나&page=-3" /></label>
        <button onClick={() => setSearch(typed)}>적용</button>
        <p>읽은 결과 → 카테고리: <strong>{category}</strong>, 페이지: <strong>{page}</strong></p>
      </div>
    </main>
  );
}
