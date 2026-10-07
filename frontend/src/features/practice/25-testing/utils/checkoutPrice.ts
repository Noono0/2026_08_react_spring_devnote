/**
 * 주문 금액 계산 규칙. 화면 코드와 분리한 "순수 함수"라서 테스트하기가 가장 쉽다.
 *   - 순수 함수: 같은 입력이면 항상 같은 결과, 바깥(화면·서버·시간)을 건드리지 않는다.
 *
 * 규칙
 *   - 상품 합계 30,000원 미만이면 배송비 3,000원
 *   - WELCOME10: 상품 합계의 10% 할인, 최대 5,000원
 *   - FREESHIP : 배송비 0원
 *   - 그 밖의 코드: 할인 없음 + "사용할 수 없는 쿠폰" 안내
 */

export const SHIPPING_FEE = 3000;
export const FREE_SHIPPING_THRESHOLD = 30000;

export interface CheckoutPrice {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponMessage: string;
}

export const calculateCheckoutPrice = (subtotal: number, rawCouponCode: string): CheckoutPrice => {
  // 잘못된 입력은 조용히 0으로 바꾸지 않고 예외로 알린다. 호출하는 쪽(화면)이 먼저 검사해야 한다.
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new RangeError("상품 합계는 0 이상의 숫자여야 합니다.");
  // " welcome10 "처럼 공백·소문자로 입력해도 같은 쿠폰으로 본다.
  const couponCode = rawCouponCode.trim().toUpperCase();
  let discount = 0;
  let shippingFee = subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
  let couponMessage = "";

  if (couponCode === "WELCOME10") {
    // 원 단위 아래는 버리고(floor), 5,000원을 넘지 않게 자른다(min).
    discount = Math.min(Math.floor(subtotal * 0.1), 5000);
    couponMessage = "10% 할인(최대 5,000원)이 적용되었습니다.";
  } else if (couponCode === "FREESHIP") {
    shippingFee = 0;
    couponMessage = "배송비 무료 쿠폰이 적용되었습니다.";
  } else if (couponCode) {
    couponMessage = "사용할 수 없는 쿠폰입니다.";
  }

  return { subtotal, discount, shippingFee, total: subtotal - discount + shippingFee, couponMessage };
};
