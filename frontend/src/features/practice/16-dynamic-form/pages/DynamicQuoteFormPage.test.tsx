import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DynamicQuoteFormPage } from "./DynamicQuoteFormPage";

const renderPage = () => render(<MemoryRouter><DynamicQuoteFormPage /></MemoryRouter>);
const row = (lineNumber: number) => screen.getByRole("group", { name: `${lineNumber}번 품목` });
const fill = (lineNumber: number, itemName: string, quantity: string, unitPrice: string) => {
  fireEvent.change(within(row(lineNumber)).getByRole("textbox", { name: "품목명" }), { target: { value: itemName } });
  fireEvent.change(within(row(lineNumber)).getByRole("spinbutton", { name: "수량" }), { target: { value: quantity } });
  fireEvent.change(within(row(lineNumber)).getByRole("spinbutton", { name: "단가(원)" }), { target: { value: unitPrice } });
};

describe("DynamicQuoteFormPage", () => {
  it("품목 줄을 추가하면 합계를 다시 계산하고 검증을 통과한 값만 작성한다", async () => {
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "고객명" }), { target: { value: "데브노트" } });
    fill(1, "기획", "2", "1000");
    fireEvent.click(screen.getByRole("button", { name: "+ 품목 추가" }));
    fill(2, "개발", "1", "5000");

    expect(screen.getByText("합계 7,000원")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "견적서 작성" }));

    expect(await screen.findByText(/총 7,000원/)).toBeInTheDocument();
    expect(screen.getByText("개발 × 1 = 5,000원")).toBeInTheDocument();
  });

  it("빈 수량을 먼저 고치게 하고, 그다음 같은 품목명을 해당 줄에 표시한다", async () => {
    renderPage();
    expect(within(row(1)).getByRole("button", { name: "1번 품목 삭제" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "고객명" }), { target: { value: "데브노트" } });
    fill(1, "개발", "1", "100");
    fireEvent.click(screen.getByRole("button", { name: "+ 품목 추가" }));
    fill(2, "개발", "", "100");

    fireEvent.click(screen.getByRole("button", { name: "견적서 작성" }));
    expect(await within(row(2)).findByText("수량을 숫자로 입력해 주세요.")).toBeInTheDocument();

    // 줄 단위 오류를 고치면 배열 전체 규칙(중복 품목명)이 검사된다.
    fireEvent.change(within(row(2)).getByRole("spinbutton", { name: /수량/ }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "견적서 작성" }));

    expect(await within(row(2)).findByText("같은 품목명이 이미 있습니다.")).toBeInTheDocument();
    expect(screen.queryByText(/총 /)).not.toBeInTheDocument();
  });

  it("삭제와 순서 이동 뒤에도 입력값이 자기 줄을 따라간다", () => {
    renderPage();
    fill(1, "첫째", "1", "1");
    fireEvent.click(screen.getByRole("button", { name: "+ 품목 추가" }));
    fill(2, "둘째", "1", "1");
    fireEvent.click(screen.getByRole("button", { name: "+ 품목 추가" }));
    fill(3, "셋째", "1", "1");

    fireEvent.click(screen.getByRole("button", { name: "1번 품목 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "2번 품목 위로" }));

    expect(within(row(1)).getByRole("textbox", { name: "품목명" })).toHaveValue("셋째");
    expect(within(row(2)).getByRole("textbox", { name: "품목명" })).toHaveValue("둘째");
  });
});
