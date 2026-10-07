import { useState } from "react";
import { calculateCheckoutPrice } from "@/features/practice/25-testing/utils/checkoutPrice";

const formatWon = (value: number): string => `${value.toLocaleString("ko-KR")}원`;

/**
 * 테스트 대상 컴포넌트. 계산은 calculateCheckoutPrice에 맡기고 입력·표시만 한다.
 * 라벨·역할(role)을 정확히 달아 두면 테스트도 "사용자가 보는 이름"으로 요소를 찾을 수 있다.
 */
export const CheckoutCalculator = () => {
  // 입력칸 값은 문자열로 그대로 보관한다. 숫자로 바로 바꾸면 사용자가 지우는 중인 빈 칸이 0으로 바뀌어 버린다.
  const [subtotalText, setSubtotalText] = useState("25000");
  const [couponCode, setCouponCode] = useState("");
  const subtotal = Number(subtotalText);
  // 빈 칸·숫자 아님·음수면 계산하지 않고 오류 문구를 보여 준다(calculateCheckoutPrice는 잘못된 값이면 예외를 던진다).
  const isValidSubtotal = subtotalText.trim() !== "" && Number.isFinite(subtotal) && subtotal >= 0;
  const price = isValidSubtotal ? calculateCheckoutPrice(subtotal, couponCode) : undefined;

  return (
    <article className="practice-card" aria-label="주문 금액 계산기">
      <h2>주문 금액 계산기</h2>
      <label>상품 합계(원)<input type="number" min={0} value={subtotalText} onChange={(event) => setSubtotalText(event.target.value)} /></label>
      <label>쿠폰 코드<input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="WELCOME10 또는 FREESHIP" /></label>
      {price ? (
        <dl className="practice-checkout-summary">
          <dt>할인</dt><dd>-{formatWon(price.discount)}</dd>
          <dt>배송비</dt><dd>{formatWon(price.shippingFee)}</dd>
          {/* data-testid: 역할·라벨로 찾기 어려운 값을 테스트가 찾도록 붙인 표시(되도록 마지막 수단으로 쓴다). */}
          <dt>결제 금액</dt><dd><strong data-testid="checkout-total">{formatWon(price.total)}</strong></dd>
        </dl>
      ) : <p className="field-error" role="alert">상품 합계는 0 이상의 숫자로 입력해 주세요.</p>}
      {price?.couponMessage ? <p role="status">{price.couponMessage}</p> : null}
    </article>
  );
};
