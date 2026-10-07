/**
 * ============================================================================
 * UrlStatePracticePage.tsx — 【고급】 검색·필터·페이지를 주소(URL)에 담기
 * ============================================================================
 *
 * [왜 useState가 아니라 주소에 담나?]
 *   useState에 둔 검색 조건은 새로고침하면 사라지고, 링크를 보내도 상대는 같은 화면을 볼 수 없다.
 *   주소(?category=책&sort=price&page=2)에 담으면
 *     - 새로고침해도 그대로
 *     - 링크를 공유하면 같은 결과
 *     - 뒤로 가기로 이전 조건으로 돌아감
 *
 * [useSearchParams]
 *   const [searchParams, setSearchParams] = useSearchParams();
 *   searchParams.get("page")  → "2" (항상 문자열 또는 null)
 *   setSearchParams(새 조건)  → 주소가 바뀌고 화면이 다시 그려진다.
 *
 * ★ 주소는 사용자가 마음대로 고칠 수 있는 "입력값"이다.
 *   ?page=바나나, ?sort=hack 같은 값이 와도 화면이 깨지지 않게 하나씩 검사하고, 틀리면 기본값을 쓴다.
 *
 * [push와 replace]
 *   페이지 이동 → 기록을 쌓는다(push). 뒤로 가기로 이전 페이지로 돌아갈 수 있다.
 *   검색어 입력 → 기록을 덮어쓴다(replace). 글자마다 기록이 쌓이면 뒤로 가기를 수십 번 눌러야 한다.
 */

import { useSearchParams } from "react-router-dom";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";

// as const: 배열·객체를 "이 값 그대로" 고정한다. 그래서 아래에서 "전체" | "프론트엔드" … 같은 정확한 타입을 뽑을 수 있다.
const categories = ["전체", "프론트엔드", "백엔드", "데브옵스"] as const;
const sortOptions = { newest: "최신순", price: "낮은 가격순", title: "제목순" } as const;
// typeof 배열[number] = 배열 안 값들의 합집합 타입, keyof typeof 객체 = 객체 키들의 합집합 타입.
type Category = typeof categories[number];
type SortOption = keyof typeof sortOptions;
const PAGE_SIZE = 6;

interface PracticeBook {
  bookId: number;
  title: string;
  category: Exclude<Category, "전체">;
  price: number;
  publishedYear: number;
}

const bookCategories: PracticeBook["category"][] = ["프론트엔드", "백엔드", "데브옵스"];
const books: PracticeBook[] = Array.from({ length: 40 }, (_, index) => ({
  bookId: index + 1,
  title: `${["React", "Spring", "Docker", "TypeScript", "MySQL"][index % 5] ?? "개발"} 실전 ${index + 1}`,
  category: bookCategories[index % bookCategories.length] ?? "프론트엔드",
  price: 18000 + ((index * 3700) % 22000),
  publishedYear: 2018 + (index % 8),
}));

/** 주소 값 검사: 허용 목록에 있으면 쓰고, 아니면 기본값 */
const readCategory = (value: string | null): Category =>
  categories.find((category) => category === value) ?? "전체";
const readSort = (value: string | null): SortOption =>
  // in 연산자로 허용된 키인지 확인한 뒤에만 SortOption으로 취급한다.
  value !== null && value in sortOptions ? value as SortOption : "newest";
const readPage = (value: string | null): number => {
  const page = Number(value);
  // Number("바나나")는 NaN, Number("2.5")는 2.5라서 정수이면서 1 이상일 때만 페이지로 인정한다.
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};

export const UrlStatePracticePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // 화면에 쓰는 값은 모두 주소에서 읽는다. 별도 useState가 없으므로 주소가 곧 "단 하나의 원본"이다.
  const keyword = searchParams.get("q") ?? "";
  const category = readCategory(searchParams.get("category"));
  const sort = readSort(searchParams.get("sort"));

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredBooks = books
    .filter((book) => category === "전체" || book.category === category)
    .filter((book) => !normalizedKeyword || book.title.toLowerCase().includes(normalizedKeyword))
    // sort는 원본 배열을 바꾸므로 filter가 만든 새 배열에서만 정렬한다. (books 원본은 그대로)
    .sort((left, right) => {
      if (sort === "price") return left.price - right.price;
      if (sort === "title") return left.title.localeCompare(right.title, "ko");
      return right.publishedYear - left.publishedYear || right.bookId - left.bookId;
    });
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  // ?page=99처럼 범위를 넘으면 마지막 페이지를 보여 준다.
  const page = Math.min(readPage(searchParams.get("page")), totalPages);
  const pageBooks = filteredBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /**
   * 조건 하나를 바꾸고 나머지는 유지한다. 기본값이면 주소에서 지워 짧게 만든다.
   * 검색·필터·정렬이 바뀌면 결과가 달라지므로 page는 1로 돌린다(지운다).
   */
  const updateParams = (changes: Record<string, string | null>, options: { replace?: boolean } = {}): void => {
    // 함수형 업데이트: 현재 주소 조건을 복사해(new URLSearchParams) 바꿀 것만 고친다. 원본 객체는 건드리지 않는다.
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      Object.entries(changes).forEach(([name, value]) => {
        if (value === null || value === "") nextParams.delete(name);
        else nextParams.set(name, value);
      });
      return nextParams;
    }, options);
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="url-state">검색·필터·페이지를 주소에 담기</LearningGuideTitle>
          <p>useSearchParams로 조건을 URL에 저장해 새로고침·링크 공유·뒤로 가기에도 같은 화면을 유지합니다.</p>
        </div>
      </div>

      <div className="practice-card practice-url-toolbar">
        {/* 입력칸 값도 State가 아니라 주소(q)에서 읽는다. 글자마다 기록이 쌓이지 않게 replace로 바꾼다. */}
        <label>검색<input value={keyword} onChange={(event) => updateParams({ q: event.target.value, page: null }, { replace: true })} placeholder="예: React" /></label>
        <label>분류
          <select value={category} onChange={(event) => updateParams({ category: event.target.value === "전체" ? null : event.target.value, page: null })}>
            {categories.map((categoryOption) => <option key={categoryOption}>{categoryOption}</option>)}
          </select>
        </label>
        <label>정렬
          <select value={sort} onChange={(event) => updateParams({ sort: event.target.value === "newest" ? null : event.target.value, page: null })}>
            {(Object.keys(sortOptions) as SortOption[]).map((sortOption) => <option key={sortOption} value={sortOption}>{sortOptions[sortOption]}</option>)}
          </select>
        </label>
        <button type="button" className="ghost-button" onClick={() => setSearchParams(new URLSearchParams())}>조건 초기화</button>
        <p className="practice-url-preview">현재 주소 조건: <code>{searchParams.toString() ? `?${searchParams.toString()}` : "(없음)"}</code></p>
      </div>

      {pageBooks.length === 0 ? <div className="state-panel">조건에 맞는 책이 없습니다.</div> : (
        <ul className="practice-check-list practice-card" aria-label="책 목록">
          {pageBooks.map((book) => (
            <li key={book.bookId}><span>{book.title}</span><small>{book.category} · {book.publishedYear}년 · {book.price.toLocaleString("ko-KR")}원</small></li>
          ))}
        </ul>
      )}

      <nav className="button-row practice-url-pagination" aria-label="페이지 이동">
        <button type="button" className="ghost-button" disabled={page <= 1} onClick={() => updateParams({ page: page - 1 <= 1 ? null : String(page - 1) })}>이전</button>
        {/* aria-current="page": 화면 낭독기에 "현재 페이지"임을 알린다. */}
        <span aria-current="page">{page} / {totalPages}</span>
        <button type="button" className="ghost-button" disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>다음</button>
      </nav>
    </section>
  );
};
