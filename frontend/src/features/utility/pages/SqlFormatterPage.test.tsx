import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SqlFormatterPage } from "./SqlFormatterPage";

const renderPage = () => render(<MemoryRouter><SqlFormatterPage /></MemoryRouter>);
const typeSql = (sql: string) => fireEvent.change(screen.getByRole("textbox", { name: "정리할 SQL 입력" }), { target: { value: sql } });
const result = () => screen.getByRole("textbox", { name: "정리 결과" });

describe("SQL Formatter 화면", () => {
  it("Ctrl+Enter로 정리하고, 정리한 뒤 옵션을 바꾸면 결과가 바로 다시 정리된다", () => {
    renderPage();
    typeSql("select a, b from t");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "정리할 SQL 입력" }), { key: "Enter", ctrlKey: true });
    expect(result()).toHaveValue("SELECT a,\n       b\nFROM   t");

    fireEvent.change(screen.getByRole("combobox", { name: "키워드" }), { target: { value: "LOWER" } });
    expect(result()).toHaveValue("select a,\n       b\nfrom   t");

    typeSql("select 1"); // 입력을 고치면 예전 결과는 지운다
    expect(result()).toHaveValue("");
  });

  it("들여쓰기 방식에서는 −/+로 1~10칸을 고르고 끝에서는 버튼을 막는다", () => {
    renderPage();
    fireEvent.change(screen.getByRole("combobox", { name: "정렬 방식" }), { target: { value: "INDENT" } });
    const increase = screen.getByRole("button", { name: "들여쓰기 한 칸 늘리기" });
    for (let count = 0; count < 12; count += 1) fireEvent.click(increase);
    expect(screen.getByRole("group", { name: "SQL 들여쓰기 칸 수" })).toHaveTextContent("10칸");
    expect(increase).toBeDisabled();
    const decrease = screen.getByRole("button", { name: "들여쓰기 한 칸 줄이기" });
    for (let count = 0; count < 12; count += 1) fireEvent.click(decrease);
    expect(screen.getByRole("group", { name: "SQL 들여쓰기 칸 수" })).toHaveTextContent("1칸");
    expect(decrease).toBeDisabled();
  });

  it("코멘트를 넣고 MyBatis 형식으로 정리하면 /* */ 주석이 붙고, Java 출력으로도 바꿀 수 있다", () => {
    renderPage();
    typeSql("select m.member_id from members m");
    fireEvent.change(screen.getByRole("textbox", { name: "테이블·칼럼 코멘트 입력" }), { target: { value: "members 회원테이블\nmembers.member_id 회원아이디" } });
    expect(screen.getByText(/인식한 코멘트 2개/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "주석 형식" }), { target: { value: "MYBATIS" } });
    fireEvent.click(screen.getByRole("button", { name: "정리하기" }));
    expect(result()).toHaveValue("SELECT m.member_id /* 회원아이디 */\nFROM   members m   /* 회원테이블 */");

    fireEvent.change(screen.getByRole("combobox", { name: "출력 형식" }), { target: { value: "JAVA_STRING_BUILDER" } });
    expect(result()).toHaveDisplayValue(/^StringBuilder sql = new StringBuilder\(\);\nsql\.append\("SELECT m\.member_id/);
  });

  it("결과를 입력으로 옮기면 입력이 결과로 바뀌고 결과는 비워진다", () => {
    renderPage();
    typeSql("select a from t");
    fireEvent.click(screen.getByRole("button", { name: "정리하기" }));
    fireEvent.click(screen.getByRole("button", { name: "결과를 입력으로" }));
    expect(screen.getByRole("textbox", { name: "정리할 SQL 입력" })).toHaveValue("SELECT a\nFROM   t");
    expect(result()).toHaveValue("");
  });
});
