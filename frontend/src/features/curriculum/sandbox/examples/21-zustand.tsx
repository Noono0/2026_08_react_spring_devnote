/**
 * 21단계 연습 — Zustand 전역 상태: 저장소(store)와 selector, persist로 새로고침 후에도 유지
 *
 * 해 볼 것
 *  1. 장바구니 비우기(clear) 버튼을 추가해 보세요.
 *  2. 합계를 저장소 밖의 selector 함수로 계산해 보세요.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CartItem { id: number; name: string; price: number; quantity: number; }
interface CartState {
  items: CartItem[];
  add: (product: Omit<CartItem, "quantity">) => void;
  remove: (id: number) => void;
}

// create: 저장소를 만들고, 그것을 읽는 훅(useCartStore)을 돌려준다. 어느 컴포넌트에서나 쓸 수 있다.
const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product) => set((state) => {
        const existing = state.items.find((item) => item.id === product.id);
        return existing
          ? { items: state.items.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)) }
          : { items: [...state.items, { ...product, quantity: 1 }] };
      }),
      remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
    }),
    { name: "sandbox-cart", storage: createJSONStorage(() => localStorage) },
  ),
);

const PRODUCTS = [{ id: 1, name: "키보드", price: 89000 }, { id: 2, name: "마우스", price: 39000 }];

// 서로 떨어진 두 컴포넌트가 같은 저장소를 본다. props로 넘겨줄 필요가 없다.
function ProductList() {
  // selector: 필요한 값(add 함수)만 구독한다. items가 바뀌어도 이 컴포넌트는 다시 그려지지 않는다.
  const add = useCartStore((state) => state.add);
  return (
    <div className="card">
      <h2>상품</h2>
      {PRODUCTS.map((product) => (
        <div key={product.id} className="row"><span>{product.name} {product.price.toLocaleString()}원</span><button onClick={() => add(product)}>담기</button></div>
      ))}
    </div>
  );
}

function Cart() {
  const items = useCartStore((state) => state.items);
  const remove = useCartStore((state) => state.remove);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className="card">
      <h2>장바구니</h2>
      {items.length === 0 ? <p className="muted">비어 있습니다.</p> : null}
      <ul className="list">
        {items.map((item) => <li key={item.id}>{item.name} × {item.quantity}<button className="danger" onClick={() => remove(item.id)}>빼기</button></li>)}
      </ul>
      <p>합계 <strong>{total.toLocaleString()}원</strong></p>
    </div>
  );
}

export default function App() {
  return (
    <main>
      <h1>Zustand 장바구니</h1>
      <p>담은 뒤 미리보기를 새로고침해도 남아 있는지 확인하세요(persist).</p>
      <ProductList />
      <Cart />
    </main>
  );
}
