/**
 * 25단계 학습 화면에 그대로 보여 주는 테스트 코드입니다. (TestingPracticePage가 ?raw로 읽어 표시)
 *
 * 1) 순수 함수 테스트 — 입력과 결과만 비교. 가장 빠르고 경계값을 촘촘히 확인하기 좋다.
 * 2) 컴포넌트 테스트 — 사용자가 하는 일(입력·클릭)을 흉내 내고, 사용자가 보는 결과를 확인한다.
 *    요소는 클래스 이름이 아니라 role·라벨 이름으로 찾는다. 화면 구조가 바뀌어도 테스트가 덜 깨진다.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { CheckoutCalculator } from "@/features/practice/25-testing/components/CheckoutCalculator";
import { calculateCheckoutPrice } from "@/features/practice/25-testing/utils/checkoutPrice";

describe("calculateCheckoutPrice (순수 함수)", () => {
  // it.each: 같은 검사를 입력만 바꿔 여러 번 돌린다. 경계값(29,999 / 30,000)을 함께 넣는 것이 핵심이다.
  it.each([
    { subtotal: 29999, expectedShipping: 3000 },
    { subtotal: 30000, expectedShipping: 0 },
  ])("상품 합계 $subtotal원이면 배송비는 $expectedShipping원", ({ subtotal, expectedShipping }) => {
    expect(calculateCheckoutPrice(subtotal, "").shippingFee).toBe(expectedShipping);
  });

  it("WELCOME10은 10%를 깎되 최대 5,000원까지만 깎는다", () => {
    expect(calculateCheckoutPrice(40000, "welcome10").discount).toBe(4000);
    expect(calculateCheckoutPrice(80000, "WELCOME10").discount).toBe(5000);
  });

  it("잘못된 금액은 조용히 넘기지 않고 오류를 던진다", () => {
    expect(() => calculateCheckoutPrice(-1, "")).toThrow(RangeError);
  });
});

describe("CheckoutCalculator (컴포넌트)", () => {
  it("쿠폰을 입력하면 안내와 결제 금액이 바뀐다", () => {
    render(<CheckoutCalculator />);
    // 처음: 25,000원 + 배송비 3,000원
    expect(screen.getByTestId("checkout-total")).toHaveTextContent("28,000원");

    fireEvent.change(screen.getByRole("textbox", { name: "쿠폰 코드" }), { target: { value: "FREESHIP" } });

    expect(screen.getByRole("status")).toHaveTextContent("배송비 무료");
    expect(screen.getByTestId("checkout-total")).toHaveTextContent("25,000원");
  });

  it("금액 칸을 비우면 계산 대신 입력 안내를 보여 준다", () => {
    render(<CheckoutCalculator />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "상품 합계(원)" }), { target: { value: "" } });

    expect(screen.getByRole("alert")).toHaveTextContent("0 이상의 숫자");
    expect(screen.queryByTestId("checkout-total")).not.toBeInTheDocument();
  });
});
