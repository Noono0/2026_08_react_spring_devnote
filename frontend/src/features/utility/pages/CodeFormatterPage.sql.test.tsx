import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CodeFormatterPage } from "./CodeFormatterPage";

const renderSqlFormatter = () => {
  render(<MemoryRouter><CodeFormatterPage /></MemoryRouter>);
  fireEvent.change(screen.getByRole("combobox", { name: "언어" }), { target: { value: "SQL" } });
};

describe("Code Formatter SQL 옵션", () => {
  it("SQL 들여쓰기는 −/+로 1~10칸 사이에서 바꾸고 끝에서는 버튼을 막는다", () => {
    renderSqlFormatter();
    const increase = screen.getByRole("button", { name: "들여쓰기 한 칸 늘리기" });
    for (let count = 0; count < 12; count += 1) fireEvent.click(increase);
    expect(screen.getByRole("group", { name: "SQL 들여쓰기 칸 수" })).toHaveTextContent("10칸");
    expect(increase).toBeDisabled();

    const decrease = screen.getByRole("button", { name: "들여쓰기 한 칸 줄이기" });
    for (let count = 0; count < 12; count += 1) fireEvent.click(decrease);
    expect(screen.getByRole("group", { name: "SQL 들여쓰기 칸 수" })).toHaveTextContent("1칸");
    expect(decrease).toBeDisabled();
  });

  it("코멘트를 넣고 MyBatis 형식으로 정리하면 /* */ 주석이 붙는다", () => {
    renderSqlFormatter();
    fireEvent.change(screen.getByRole("textbox", { name: "테이블·칼럼 코멘트 입력" }), { target: { value: "members 회원테이블\nmembers.member_id 회원아이디" } });
    expect(screen.getByText(/인식한 코멘트 2개/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "주석 형식" }), { target: { value: "MYBATIS" } });
    fireEvent.click(screen.getByRole("button", { name: "정리하기" }));

    const result = screen.getByRole("textbox", { name: "포맷 결과" });
    expect(result).toHaveDisplayValue(/m\.member_id,\s+\/\* 회원아이디 \*\//);
    expect(result).toHaveDisplayValue(/FROM members m\s+\/\* 회원테이블 \*\//);
  });
});
