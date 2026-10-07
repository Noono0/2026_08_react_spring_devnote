import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactFundamentalsPage } from "./ReactFundamentalsPage";

const renderPage = () => render(<MemoryRouter><ReactFundamentalsPage /></MemoryRouter>);

describe("ReactFundamentalsPage", () => {
  it("버튼을 누르면 State가 바뀌고 화면의 숫자가 다시 그려진다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "증가" }));
    fireEvent.click(screen.getByRole("button", { name: "증가" }));
    fireEvent.click(screen.getByRole("button", { name: "감소" }));
    expect(screen.getByText("1", { selector: ".large-value" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getByText("0", { selector: ".large-value" })).toBeInTheDocument();
  });

  it("제어 컴포넌트 입력값이 인사말에 바로 반영된다", () => {
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "데브노트" } });
    expect(screen.getByText("데브노트님, React 연습을 시작합니다.")).toBeInTheDocument();
  });

  it("조건이 false가 되면 설명 문장이 DOM에서 사라진다", () => {
    renderPage();
    expect(screen.getByText(/조건이 true일 때만/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "설명 숨기기" }));
    expect(screen.queryByText(/조건이 true일 때만/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "설명 보기" })).toBeInTheDocument();
  });
});
