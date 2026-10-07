import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TestingPracticePage } from "./TestingPracticePage";

describe("TestingPracticePage", () => {
  it("계산기와 그 계산기의 실제 테스트 코드를 함께 보여 준다", () => {
    render(<MemoryRouter><TestingPracticePage /></MemoryRouter>);

    expect(screen.getByRole("article", { name: "주문 금액 계산기" })).toBeInTheDocument();
    // ?raw로 가져온 테스트 파일 내용이 그대로 표시되는지 확인한다.
    expect(screen.getByLabelText("계산기 테스트 코드")).toHaveTextContent("describe(\"calculateCheckoutPrice (순수 함수)\"");
  });
});
