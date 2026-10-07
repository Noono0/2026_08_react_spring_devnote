import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PRACTICE_CART_STORAGE_KEY, selectCartTotal, usePracticeCartStore } from "@/features/practice/21-zustand/state/practiceCartStore";
import { ZustandCartPracticePage } from "./ZustandCartPracticePage";

const renderPage = () => render(<MemoryRouter><ZustandCartPracticePage /></MemoryRouter>);

describe("Zustand 장바구니", () => {
  beforeEach(() => {
    // 저장소는 테스트 파일 안에서 하나만 존재하므로 매번 비우고 시작한다.
    usePracticeCartStore.setState({ items: [] });
    localStorage.clear();
  });

  it("담기·수량 변경이 배지·목록·합계에 함께 반영되고 localStorage에 저장된다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "기계식 키보드 담기" }));
    fireEvent.click(screen.getByRole("button", { name: "기계식 키보드 담기" }));
    fireEvent.click(screen.getByRole("button", { name: "무선 마우스 담기" }));

    expect(screen.getByRole("status")).toHaveTextContent("장바구니 3개");
    expect(screen.getByText("합계 217,000원")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton", { name: "무선 마우스 수량" }), { target: { value: "20" } });
    expect(screen.getByRole("spinbutton", { name: "무선 마우스 수량" })).toHaveValue(9);
    expect(JSON.parse(localStorage.getItem(PRACTICE_CART_STORAGE_KEY) ?? "{}")).toMatchObject({ state: { items: [{ quantity: 2 }, { quantity: 9 }] } });

    fireEvent.click(screen.getByRole("button", { name: "기계식 키보드 빼기" }));
    expect(within(screen.getByRole("list", { name: "담은 상품" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("저장값이 잘못된 모양이면 복원하지 않고 빈 장바구니로 둔다", async () => {
    localStorage.setItem(PRACTICE_CART_STORAGE_KEY, JSON.stringify({ state: { items: [{ productId: "x", quantity: 100 }] }, version: 0 }));
    await usePracticeCartStore.persist.rehydrate();
    expect(usePracticeCartStore.getState().items).toEqual([]);
  });

  it("합계는 저장하지 않고 목록에서 계산한다", () => {
    expect(selectCartTotal({ items: [{ productId: 1, productName: "A", unitPrice: 1000, quantity: 3 }] })).toBe(3000);
  });
});
