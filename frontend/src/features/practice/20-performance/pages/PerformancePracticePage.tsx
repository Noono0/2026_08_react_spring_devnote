/**
 * ============================================================================
 * PerformancePracticePage.tsx — 【고급】 측정하고 나서 최적화하기 (memo·useCallback·useDeferredValue)
 * ============================================================================
 *
 * 상품 2,000개 목록에서 즐겨찾기를 하나 누르거나 검색어를 칠 때 얼마나 다시 그리는지 "측정"한다.
 *
 * [원칙: 느끼지 말고 재라]
 *   memo·useCallback·useMemo는 공짜가 아니다(비교 비용, 코드 복잡도).
 *   그래서 이 프로젝트 규칙도 "효과를 설명할 수 있을 때만" 쓰라고 한다.
 *   여기서는 React의 <Profiler>로 렌더링 시간을 재서 효과를 숫자로 확인한다.
 *     actualDuration → 이번에 실제로 렌더링하는 데 걸린 시간
 *     baseDuration   → 최적화 없이 전부 다시 그렸다면 걸렸을 시간(추정)
 *
 * [최적화 켜기를 누르면 바뀌는 두 가지]
 *   1. 줄 컴포넌트를 memo로 감싼다 → props가 같으면 다시 그리지 않는다.
 *   2. 즐겨찾기 함수를 useCallback으로 고정한다 → 렌더링마다 새 함수가 되지 않아 memo의 비교가 통과한다.
 *   ★ 둘 중 하나만 하면 효과가 없다. memo만 하고 함수를 매번 새로 만들면 props가 "달라져" 결국 다시 그린다.
 *
 * [useDeferredValue]
 *   검색어 입력칸은 즉시 바뀌고, 무거운 목록 거르기는 "조금 늦게" 따라오게 한다.
 *   그래서 목록이 커도 타이핑이 끊기지 않는다. 늦게 따라오는 동안은 "목록 갱신 중"을 보여 준다.
 *
 * [확인할 것]
 *   최적화 끔 상태에서 즐겨찾기 → 측정값 보기, 최적화 켬 상태에서 같은 동작 → 측정값 비교.
 *   개발 모드(npm run dev)는 검사 코드 때문에 느리게 나오니 숫자는 "비교"로만 본다.
 */

import { memo, Profiler, useCallback, useDeferredValue, useMemo, useRef, useState, type ProfilerOnRenderCallback } from "react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";

interface PracticeProduct {
  productId: number;
  productName: string;
  categoryName: string;
}

interface RenderMeasurement {
  phase: string;
  actualDuration: number;
  baseDuration: number;
}

const PRODUCT_COUNT = 2000;
const categories = ["키보드", "마우스", "모니터", "의자", "책상"];
// 고정 데이터라 컴포넌트 바깥에서 한 번만 만든다. 안에 두면 렌더링마다 2,000개를 다시 만든다.
const practiceProducts: PracticeProduct[] = Array.from({ length: PRODUCT_COUNT }, (_, index) => ({
  productId: index + 1,
  productName: `${categories[index % categories.length] ?? "상품"} ${index + 1}호`,
  categoryName: categories[index % categories.length] ?? "기타",
}));

interface ProductRowProperties {
  product: PracticeProduct;
  favorite: boolean;
  onToggleFavorite: (productId: number) => void;
}

/** 상품 한 줄. 최적화 비교를 위해 memo로 감싼 것(MemoizedProductRow)과 감싸지 않은 것을 번갈아 쓴다. */
const ProductRow = ({ product, favorite, onToggleFavorite }: ProductRowProperties) => (
  <li className="practice-performance-row">
    <span>{product.productName}</span>
    <small>{product.categoryName}</small>
    <button type="button" className={favorite ? undefined : "ghost-button"} aria-pressed={favorite} aria-label={`${product.productName} 즐겨찾기`} onClick={() => onToggleFavorite(product.productId)}>
      {favorite ? "★" : "☆"}
    </button>
  </li>
);

// memo: props(product·favorite·onToggleFavorite)가 이전과 같으면(===) 이 줄은 다시 그리지 않는다.
const MemoizedProductRow = memo(ProductRow);

export const PerformancePracticePage = () => {
  const [optimized, setOptimized] = useState(false);
  // ReadonlySet: 직접 add/delete로 바꾸지 못하게 타입으로 막는다. 바꿀 때는 새 Set을 만든다(불변성).
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(() => new Set());
  const [keyword, setKeyword] = useState("");
  // deferredKeyword는 급한 작업(타이핑)이 끝난 뒤에 keyword를 따라온다. 둘이 다르면 "아직 갱신 중"이다.
  const deferredKeyword = useDeferredValue(keyword);
  const isListStale = keyword !== deferredKeyword;

  // Profiler 결과는 렌더링 도중에 들어오므로 State가 아니라 ref에 담는다.
  // (onRender 안에서 setState를 하면 다시 렌더링 → 다시 onRender → 무한 반복이 된다)
  const lastMeasurementRef = useRef<RenderMeasurement | undefined>(undefined);
  // "unavailable": 운영 빌드에서는 Profiler가 측정하지 않아 값이 없다.
  const [shownMeasurement, setShownMeasurement] = useState<RenderMeasurement | "unavailable">();
  const recordRender: ProfilerOnRenderCallback = (_id, phase, actualDuration, baseDuration) => {
    lastMeasurementRef.current = { phase, actualDuration, baseDuration };
  };

  // 2,000개를 거르는 계산은 검색어가 바뀔 때만 다시 한다. (즐겨찾기를 눌렀을 때는 다시 거를 필요가 없다)
  const visibleProducts = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();
    return normalizedKeyword
      ? practiceProducts.filter((product) => product.productName.toLowerCase().includes(normalizedKeyword))
      : practiceProducts;
  }, [deferredKeyword]);

  // 함수형 업데이트(previous => ...)를 쓰면 바깥 값을 읽지 않으므로 의존성이 없어 함수가 한 번만 만들어진다.
  const toggleFavoriteStable = useCallback((productId: number) => {
    setFavoriteIds((previousIds) => {
      // 이전 Set을 복사해 새 Set을 만든다. 같은 Set을 고치면 React가 바뀐 줄 모르고 다시 그리지 않는다.
      const nextIds = new Set(previousIds);
      if (nextIds.has(productId)) nextIds.delete(productId);
      else nextIds.add(productId);
      return nextIds;
    });
  }, []);
  // 최적화를 끈 상태: 렌더링할 때마다 새 함수가 만들어져 모든 줄의 props가 "바뀐 것"이 된다.
  const toggleFavorite = optimized ? toggleFavoriteStable : (productId: number) => toggleFavoriteStable(productId);
  // 컴포넌트도 값이라 변수에 담아 고를 수 있다. 대문자로 시작해야 JSX에서 컴포넌트로 인식된다.
  const RowComponent = optimized ? MemoizedProductRow : ProductRow;

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="performance">측정하고 나서 최적화하기</LearningGuideTitle>
          <p>Profiler로 렌더링 시간을 재고, memo·useCallback·useDeferredValue를 켜고 끄며 비교합니다.</p>
        </div>
      </div>

      <div className="practice-card practice-performance-toolbar">
        <label className="checkbox-label"><input type="checkbox" checked={optimized} onChange={(event) => setOptimized(event.target.checked)} />최적화 켜기 (memo + useCallback)</label>
        <label>검색<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="예: 모니터 12" /></label>
        <button type="button" className="secondary-button" onClick={() => setShownMeasurement(lastMeasurementRef.current ?? "unavailable")}>측정값 보기</button>
        <p aria-live="polite">
          {shownMeasurement === "unavailable"
            ? "측정값이 없습니다. React Profiler는 개발 모드(npm run dev)에서만 시간을 잽니다."
            : shownMeasurement
            ? `마지막 ${shownMeasurement.phase === "mount" ? "첫 렌더링" : "다시 렌더링"}: 실제 ${shownMeasurement.actualDuration.toFixed(1)}ms · 전부 다시 그리면 약 ${shownMeasurement.baseDuration.toFixed(1)}ms`
            : "동작을 한 뒤 측정값 보기를 누르세요."}
        </p>
      </div>

      <p className="practice-performance-summary" aria-live="polite">
        {isListStale ? "목록 갱신 중..." : `${visibleProducts.length.toLocaleString()}개 표시 · 즐겨찾기 ${favoriteIds.size}개`}
      </p>

      {/* Profiler: 안쪽이 렌더링될 때마다 onRender를 불러 걸린 시간을 알려 준다(개발 모드에서만 측정). */}
      <Profiler id="practice-product-list" onRender={recordRender}>
        {/* 갱신이 늦게 따라오는 동안 흐리게 표시해 "아직 옛 결과"라는 걸 알려 준다. */}
        <ul className="practice-performance-list" aria-label="상품 목록" style={{ opacity: isListStale ? 0.6 : 1 }}>
          {visibleProducts.map((product) => (
            <RowComponent key={product.productId} product={product} favorite={favoriteIds.has(product.productId)} onToggleFavorite={toggleFavorite} />
          ))}
        </ul>
      </Profiler>
    </section>
  );
};
