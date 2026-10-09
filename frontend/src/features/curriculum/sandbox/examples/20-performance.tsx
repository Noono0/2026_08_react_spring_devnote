/**
 * 20단계 연습 — 성능: memo·useCallback으로 불필요한 다시 그리기 줄이기, useDeferredValue
 *
 * 해 볼 것
 *  1. "최적화" 체크를 끄고 켜며 즐겨찾기를 누를 때 다시 그려진 줄 수를 비교해 보세요.
 *  2. useDeferredValue를 빼고 검색창에 빠르게 입력해 보세요.
 */
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";

interface Product { id: number; name: string; }
const products: Product[] = Array.from({ length: 2000 }, (_, index) => ({ id: index + 1, name: `상품 ${index + 1}` }));

// 렌더링 횟수를 세기 위한 카운터(연습용). 실제 측정은 React DevTools Profiler를 쓴다.
const renderCounter = { rows: 0 };

interface RowProps { product: Product; favorite: boolean; onToggle: (id: number) => void; }
function Row({ product, favorite, onToggle }: RowProps) {
  renderCounter.rows += 1;
  return <li><button className="secondary" onClick={() => onToggle(product.id)}>{favorite ? "★" : "☆"}</button>{product.name}</li>;
}
// memo: props가 그대로면 다시 그리지 않는다. 단, 함수 props가 매번 새로 만들어지면 소용없다.
const MemoRow = memo(Row);

export default function App() {
  const [optimized, setOptimized] = useState(true);
  const [favorites, setFavorites] = useState<ReadonlySet<number>>(new Set());
  const [keyword, setKeyword] = useState("");
  // 입력은 바로 반영하고, 무거운 목록 거르기는 조금 늦게 따라오게 한다.
  const deferredKeyword = useDeferredValue(keyword);
  renderCounter.rows = 0;

  // useCallback: 다시 그려져도 같은 함수를 유지해 MemoRow가 바뀐 줄 모르게 한다.
  const toggleStable = useCallback((id: number) => setFavorites((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const toggleUnstable = (id: number) => toggleStable(id);

  const visible = useMemo(() => products.filter((product) => product.name.includes(deferredKeyword)).slice(0, 200), [deferredKeyword]);
  const RowComponent = optimized ? MemoRow : Row;
  const onToggle = optimized ? toggleStable : toggleUnstable;

  return (
    <main>
      <h1>성능 측정</h1>
      <label className="row"><input type="checkbox" checked={optimized} onChange={(event) => setOptimized(event.target.checked)} />최적화(memo + useCallback)</label>
      <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="상품 검색" />
      <p className="muted">즐겨찾기 {favorites.size}개 · 콘솔에서 다시 그린 줄 수를 확인하세요.</p>
      <ul className="list">
        {visible.map((product) => <RowComponent key={product.id} product={product} favorite={favorites.has(product.id)} onToggle={onToggle} />)}
      </ul>
      {/* 화면을 그린 뒤 몇 줄이 다시 그려졌는지 콘솔에 남긴다 */}
      <LogRenderCount />
    </main>
  );
}

function LogRenderCount() {
  console.log("다시 그린 줄 수:", renderCounter.rows);
  return null;
}
