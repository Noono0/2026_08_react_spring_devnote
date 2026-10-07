/**
 * ============================================================================
 * ZustandCartPracticePage.tsx — 【고급】 Zustand 전역 상태로 장바구니 만들기
 * ============================================================================
 *
 * 화면은 세 덩어리이고, 서로 props를 하나도 주고받지 않는다. 모두 같은 저장소(usePracticeCartStore)를 읽는다.
 *   CartBadge   → 담긴 개수만 구독한다.
 *   ProductList → 담기 함수만 구독한다. (함수는 바뀌지 않으므로 장바구니가 바뀌어도 다시 그려지지 않는다)
 *   CartPanel   → 담긴 목록과 합계를 구독한다.
 *
 * [확인할 것]
 *   1. 상품을 담으면 위쪽 배지와 오른쪽 장바구니가 함께 바뀐다(Provider 없이).
 *   2. 새로고침해도 장바구니가 남는다(persist). Local Storage의 practiceCart 값을 확인해 보자.
 *   3. 17단계 Context 예제와 비교: 거기서는 Provider로 감싸야 했고 value가 바뀌면 읽는 컴포넌트가 모두 다시 그려졌다.
 */

import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import {
  MAX_CART_QUANTITY,
  selectCartCount,
  selectCartTotal,
  usePracticeCartStore,
} from "@/features/practice/21-zustand/state/practiceCartStore";

// 고정 상품 목록. 서버 데이터가 아니라 화면 상수라 저장소에 넣지 않는다(저장소에는 "바뀌는 값"만 둔다).
const products = [
  { productId: 1, productName: "기계식 키보드", unitPrice: 89000 },
  { productId: 2, productName: "무선 마우스", unitPrice: 39000 },
  { productId: 3, productName: "모니터 받침대", unitPrice: 25000 },
];
const formatWon = (value: number): string => `${value.toLocaleString("ko-KR")}원`;

const CartBadge = () => {
  // ★ selector: 저장소 전체가 아니라 "개수"라는 숫자 하나만 꺼낸다. 이 숫자가 같으면 다시 그리지 않는다.
  const count = usePracticeCartStore(selectCartCount);
  return <span className="practice-status-chip" role="status">장바구니 {count}개</span>;
};

const ProductList = () => {
  // 함수만 구독한다. Zustand의 액션 함수는 저장소를 만들 때 한 번 생기고 바뀌지 않으므로, 이 목록은 담기를 눌러도 다시 그려지지 않는다.
  const addItem = usePracticeCartStore((state) => state.addItem);
  return (
    <article className="practice-card">
      <h2>상품</h2>
      <ul className="practice-check-list" aria-label="상품 목록">
        {products.map((product) => (
          <li key={product.productId}>
            <span>{product.productName} · {formatWon(product.unitPrice)}</span>
            <button type="button" aria-label={`${product.productName} 담기`} onClick={() => addItem(product)}>담기</button>
          </li>
        ))}
      </ul>
    </article>
  );
};

const CartPanel = () => {
  // 값 하나마다 따로 구독한다. 한 번에 객체로 꺼내면({ items, total }) 매번 새 객체라 "바뀐 것"으로 판단될 수 있다.
  const items = usePracticeCartStore((state) => state.items);
  const total = usePracticeCartStore(selectCartTotal);
  const changeQuantity = usePracticeCartStore((state) => state.changeQuantity);
  const removeItem = usePracticeCartStore((state) => state.removeItem);
  const clear = usePracticeCartStore((state) => state.clear);

  return (
    <article className="practice-card" aria-label="장바구니">
      <h2>장바구니</h2>
      {items.length === 0 ? <p>장바구니가 비어 있습니다.</p> : (
        <>
          <ul className="practice-check-list" aria-label="담은 상품">
            {items.map((item) => (
              <li key={item.productId}>
                <span>{item.productName}</span>
                <label>수량
                  {/* 입력칸 값은 항상 문자열이므로 Number로 바꿔 넘긴다. 범위(1~9)는 저장소의 changeQuantity가 다시 맞춘다. */}
                  <input type="number" min={1} max={MAX_CART_QUANTITY} value={item.quantity} aria-label={`${item.productName} 수량`} onChange={(event) => changeQuantity(item.productId, Number(event.target.value))} />
                </label>
                <button type="button" className="ghost-button" aria-label={`${item.productName} 빼기`} onClick={() => removeItem(item.productId)}>빼기</button>
              </li>
            ))}
          </ul>
          <p><strong>합계 {formatWon(total)}</strong></p>
          <button type="button" className="danger-button" onClick={clear}>비우기</button>
        </>
      )}
    </article>
  );
};

export const ZustandCartPracticePage = () => (
  <section>
    <div className="page-heading-row">
      <div>
        <span className="level-badge level-고급">고급</span>
        <LearningGuideTitle guideId="zustand">Zustand 전역 상태로 장바구니 만들기</LearningGuideTitle>
        <p>Provider 없이 저장소를 공유하고, selector로 필요한 값만 구독하며, persist로 새로고침 후에도 유지합니다.</p>
      </div>
      <CartBadge />
    </div>
    <div className="split-practice-layout">
      <ProductList />
      <CartPanel />
    </div>
  </section>
);
