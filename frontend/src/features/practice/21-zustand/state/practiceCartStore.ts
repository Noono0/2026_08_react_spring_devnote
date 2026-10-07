/**
 * ============================================================================
 * practiceCartStore.ts — Zustand로 만든 장바구니 전역 저장소
 * ============================================================================
 *
 * [Context(17단계)와 무엇이 다른가]
 *   Context : Provider로 감싸야 하고, value가 바뀌면 그 Context를 읽는 컴포넌트가 "전부" 다시 그려진다.
 *   Zustand : Provider가 필요 없고, 컴포넌트가 "고른 값(selector)"이 바뀔 때만 다시 그려진다.
 *     const count = usePracticeCartStore((state) => state.items.length);
 *     → 장바구니 수량이 바뀌어도 개수가 같으면 이 컴포넌트는 다시 그리지 않는다.
 *
 * [persist 미들웨어]
 *   저장소 값을 localStorage에 자동으로 저장·복원한다(새 의존성 없이 zustand에 들어 있다).
 *   ★ 복원할 때 저장값을 그대로 믿지 않고 merge에서 Zod로 검사한다. 모양이 틀리면 빈 장바구니로 시작한다.
 *
 * [불변성]
 *   set((state) => ({ items: [...] })) 처럼 항상 새 배열·새 객체를 돌려준다.
 *   state.items.push(...)처럼 직접 바꾸면 Zustand가 바뀐 줄 몰라 화면이 갱신되지 않는다.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";

export const MAX_CART_QUANTITY = 9;

// 장바구니 한 줄의 모양. 타입(CartItem)도 이 스키마에서 뽑아 써서 둘이 어긋나지 않는다.
const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
});
export type CartItem = z.infer<typeof cartItemSchema>;
const persistedCartSchema = z.object({ items: z.array(cartItemSchema) });

// 저장소 = 데이터(items) + 그 데이터를 바꾸는 함수(액션)를 한 객체에 모은 것.
interface PracticeCartState {
  items: CartItem[];
  // Omit<CartItem, "quantity">: CartItem에서 quantity만 뺀 타입. 담을 때 수량은 저장소가 정한다.
  addItem: (product: Omit<CartItem, "quantity">) => void;
  changeQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
}

export const PRACTICE_CART_STORAGE_KEY = "practiceCart";

// create<타입>()(...): 저장소를 만들고 그것을 읽는 훅(usePracticeCartStore)을 돌려준다.
// ()를 한 번 더 쓰는 형태는 미들웨어(persist)와 함께 쓸 때 TypeScript가 타입을 잘 추론하게 하는 zustand 권장 문법이다.
export const usePracticeCartStore = create<PracticeCartState>()(
  persist(
    // set: 저장소 값을 바꾸는 함수. 돌려준 객체가 기존 상태에 얕게 합쳐진다(items만 돌려주면 items만 바뀐다).
    (set) => ({
      items: [],
      // 이미 담긴 상품이면 수량만 1 늘리고(최대 9), 없으면 새로 담는다.
      addItem: (product) => set((state) => {
        const existing = state.items.find((item) => item.productId === product.productId);
        if (!existing) return { items: [...state.items, { ...product, quantity: 1 }] };
        return {
          items: state.items.map((item) => item.productId === product.productId
            ? { ...item, quantity: Math.min(item.quantity + 1, MAX_CART_QUANTITY) }
            : item),
        };
      }),
      changeQuantity: (productId, quantity) => set((state) => ({
        // 1보다 작게는 줄이지 않는다. 빼려면 삭제 버튼을 쓴다.
        items: state.items.map((item) => item.productId === productId
          // 소수점은 버리고(trunc) 1~9 범위로 자른다. 사용자가 입력칸에 0이나 100을 넣어도 안전한 값이 된다.
          ? { ...item, quantity: Math.min(Math.max(Math.trunc(quantity), 1), MAX_CART_QUANTITY) }
          : item),
      })),
      removeItem: (productId) => set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: PRACTICE_CART_STORAGE_KEY,
      // 저장 위치를 localStorage로, 값은 JSON 문자열로 바꿔 저장한다.
      storage: createJSONStorage(() => localStorage),
      // 함수는 저장할 수 없으므로 데이터(items)만 저장한다.
      partialize: (state) => ({ items: state.items }),
      // 저장값 검증: 통과한 값만 현재 상태에 합친다.
      merge: (persistedState, currentState) => {
        const parsed = persistedCartSchema.safeParse(persistedState);
        return parsed.success ? { ...currentState, items: parsed.data.items } : currentState;
      },
    },
  ),
);

/** 합계처럼 다른 값에서 계산할 수 있는 값은 저장소에 따로 두지 않고 계산 함수로 만든다. */
// Pick<…, "items">: 저장소 전체가 아니라 items만 있으면 계산할 수 있다는 뜻. 테스트에서 간단한 객체로 시험하기 쉽다.
export const selectCartTotal = (state: Pick<PracticeCartState, "items">): number =>
  state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
export const selectCartCount = (state: Pick<PracticeCartState, "items">): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);
